use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("EXjLoxj7w7Au9imdv8zH9XndZxbNd4NwDbv4bvqx9QUS");

pub const MAX_HOLD_DAYS: i64     = 5;
pub const MAX_VAULT_MONTHS: u8   = 5;
pub const PROTOCOL_FEE_BPS: u64 = 20;

#[program]
pub mod jupremit {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, _bump: u8) -> Result<()> {
        let cfg        = &mut ctx.accounts.config;
        cfg.owner      = ctx.accounts.owner.key();
        cfg.fee_wallet = ctx.accounts.fee_wallet.key();
        cfg.bump       = ctx.bumps.config;
        cfg.paused     = false;
        emit!(ConfigInitialized { owner: cfg.owner });
        Ok(())
    }

    pub fn create_direct_send(
        ctx:              Context<CreateDirectSend>,
        amount_usdc:      u64,
        yield_vehicle:    YieldVehicle,
        recipient_wallet: Pubkey,
        auto_release_ts:  i64,
        _bump:            u8,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, JupRemitError::Paused);
        require!(amount_usdc > 0,             JupRemitError::ZeroAmount);
        let now    = Clock::get()?.unix_timestamp;
        let max_ts = now + MAX_HOLD_DAYS * 86_400;
        require!(auto_release_ts > now,    JupRemitError::ReleaseInPast);
        require!(auto_release_ts <= max_ts, JupRemitError::ReleaseTooLate);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.sender_usdc_ata.to_account_info(),
                    to:        ctx.accounts.escrow_vault.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount_usdc,
        )?;

        let escrow_key = ctx.accounts.escrow.key();
        let e              = &mut ctx.accounts.escrow;
        e.sender           = ctx.accounts.sender.key();
        e.recipient        = recipient_wallet;
        e.amount_deposited = amount_usdc;
        e.yield_vehicle    = yield_vehicle.clone();
        e.auto_release_ts  = auto_release_ts;
        e.created_at       = now;
        e.claimed          = false;
        e.returned         = false;
        e.bump             = ctx.bumps.escrow;

        emit!(DirectSendCreated {
            escrow:     escrow_key,
            sender:     e.sender,
            recipient:  recipient_wallet,
            amount:     amount_usdc,
            release_ts: auto_release_ts,
        });
        Ok(())
    }

    pub fn claim_direct_send(ctx: Context<ClaimDirectSend>) -> Result<()> {
        // Read all values before mutable borrow
        let escrow_key    = ctx.accounts.escrow.key();
        let recipient_key = ctx.accounts.recipient.key();
        let already_claimed  = ctx.accounts.escrow.claimed;
        let already_returned = ctx.accounts.escrow.returned;
        let escrow_recipient = ctx.accounts.escrow.recipient;
        let release_ts       = ctx.accounts.escrow.auto_release_ts;
        let sender_key_e     = ctx.accounts.escrow.sender;
        let bump_e           = ctx.accounts.escrow.bump;

        require!(!already_claimed,  JupRemitError::AlreadyClaimed);
        require!(!already_returned, JupRemitError::AlreadyReturned);
        require!(recipient_key == escrow_recipient, JupRemitError::NotRecipient);

        let now = Clock::get()?.unix_timestamp;
        require!(now <= release_ts, JupRemitError::EscrowExpired);

        let seeds  = &[b"escrow" as &[u8], sender_key_e.as_ref(), &[bump_e]];
        let signer = &[&seeds[..]];

        let balance = ctx.accounts.escrow_vault.amount;
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.escrow_vault.to_account_info(),
                    to:        ctx.accounts.recipient_usdc_ata.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer,
            ),
            balance,
        )?;

        ctx.accounts.escrow.claimed = true;
        emit!(DirectSendClaimed { escrow: escrow_key, recipient: recipient_key, amount: balance });
        Ok(())
    }

    pub fn return_to_sender(ctx: Context<ReturnToSender>) -> Result<()> {
        // Read immutable values first
        let escrow_key2      = ctx.accounts.escrow.key();
        let sender_key_r     = ctx.accounts.escrow.sender;
        let bump_r           = ctx.accounts.escrow.bump;
        let already_claimed  = ctx.accounts.escrow.claimed;
        let already_returned = ctx.accounts.escrow.returned;
        let release_ts       = ctx.accounts.escrow.auto_release_ts;

        require!(!already_claimed,  JupRemitError::AlreadyClaimed);
        require!(!already_returned, JupRemitError::AlreadyReturned);

        let now = Clock::get()?.unix_timestamp;
        require!(now > release_ts, JupRemitError::NotYetExpired);

        let seeds  = &[b"escrow" as &[u8], sender_key_r.as_ref(), &[bump_r]];
        let signer = &[&seeds[..]];

        let balance = ctx.accounts.escrow_vault.amount;
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.escrow_vault.to_account_info(),
                    to:        ctx.accounts.sender_usdc_ata.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer,
            ),
            balance,
        )?;

        ctx.accounts.escrow.returned = true;
        emit!(FundsReturnedToSender { escrow: escrow_key2, sender: sender_key_r, amount: balance });
        Ok(())
    }

    pub fn create_savings_vault(
        ctx:             Context<CreateSavingsVault>,
        monthly_amount:  u64,
        duration_months: u8,
        maturity_ts:     i64,
        yield_vehicle:   YieldVehicle,
        _bump:           u8,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, JupRemitError::Paused);
        require!(monthly_amount > 0,          JupRemitError::ZeroAmount);
        require!(
            duration_months >= 1 && duration_months <= MAX_VAULT_MONTHS,
            JupRemitError::InvalidDuration
        );
        let now = Clock::get()?.unix_timestamp;
        require!(maturity_ts > now, JupRemitError::ReleaseInPast);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.sender_usdc_ata.to_account_info(),
                    to:        ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            monthly_amount,
        )?;

        // Capture keys before mutable borrow
        let vault_key_csv = ctx.accounts.savings_vault.key();
        let sender_csv    = ctx.accounts.sender.key();

        let v              = &mut ctx.accounts.savings_vault;
        v.sender           = sender_csv;
        v.monthly_amount   = monthly_amount;
        v.duration_months  = duration_months;
        v.months_deposited = 1;
        v.total_deposited  = monthly_amount;
        v.yield_vehicle    = yield_vehicle.clone();
        v.maturity_ts      = maturity_ts;
        v.created_at       = now;
        v.matured          = false;
        v.extended         = false;
        v.bump             = ctx.bumps.savings_vault;

        emit!(SavingsVaultCreated {
            vault:          vault_key_csv,
            sender:         sender_csv,
            monthly_amount,
            duration_months,
            maturity_ts,
        });
        Ok(())
    }

    pub fn deposit_monthly(ctx: Context<DepositMonthly>) -> Result<()> {
        // Capture key before mutable borrow
        let vault_key_dm = ctx.accounts.savings_vault.key();

        let v = &mut ctx.accounts.savings_vault;
        require!(!v.matured, JupRemitError::VaultMatured);
        require!(
            v.months_deposited < v.duration_months,
            JupRemitError::AllMonthsDeposited
        );

        let monthly = v.monthly_amount;
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.sender_usdc_ata.to_account_info(),
                    to:        ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            monthly,
        )?;

        v.months_deposited = v.months_deposited.saturating_add(1);
        v.total_deposited  = v.total_deposited.saturating_add(monthly);

        let month_dm  = v.months_deposited;
        let amount_dm = monthly;
        let total_dm  = v.total_deposited;
        emit!(MonthlyDeposit {
            vault:  vault_key_dm,
            month:  month_dm,
            amount: amount_dm,
            total:  total_dm,
        });
        Ok(())
    }

    pub fn extend_vault(
        ctx:               Context<ExtendVault>,
        additional_months: u8,
        new_maturity_ts:   i64,
    ) -> Result<()> {
        // Capture key before mutable borrow
        let vault_key_ev = ctx.accounts.savings_vault.key();

        let v = &mut ctx.accounts.savings_vault;
        require!(!v.matured, JupRemitError::VaultMatured);
        require!(ctx.accounts.sender.key() == v.sender, JupRemitError::NotOwner);

        let now = Clock::get()?.unix_timestamp;
        require!(now < v.maturity_ts,             JupRemitError::AlreadyMatured);
        require!(new_maturity_ts > v.maturity_ts, JupRemitError::ReleaseInPast);

        let new_total = v.duration_months
            .checked_add(additional_months)
            .ok_or(JupRemitError::InvalidDuration)?;
        require!(new_total <= MAX_VAULT_MONTHS * 2, JupRemitError::InvalidDuration);

        let old           = v.maturity_ts;
        v.duration_months = new_total;
        v.maturity_ts     = new_maturity_ts;
        v.extended        = true;

        emit!(VaultExtended {
            vault:        vault_key_ev,
            old_maturity: old,
            new_maturity: new_maturity_ts,
            total_months: new_total,
        });
        Ok(())
    }

    pub fn mature_vault(ctx: Context<MatureVault>) -> Result<()> {
        // Extract ALL immutable values before any mutable borrow
        let vault_key  = ctx.accounts.savings_vault.key();
        let sender_key = ctx.accounts.savings_vault.sender;
        let bump       = ctx.accounts.savings_vault.bump;
        let total_dep  = ctx.accounts.savings_vault.total_deposited;
        let maturity   = ctx.accounts.savings_vault.maturity_ts;
        let is_matured = ctx.accounts.savings_vault.matured;

        require!(!is_matured, JupRemitError::VaultMatured);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= maturity, JupRemitError::NotYetMatured);

        let seeds  = &[b"vault" as &[u8], sender_key.as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        let balance       = ctx.accounts.vault_token_account.amount;
        let yield_earned  = balance.saturating_sub(total_dep);
        let fee           = yield_earned.saturating_mul(PROTOCOL_FEE_BPS) / 10_000;
        let sender_amount = balance.saturating_sub(fee);

        if fee > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from:      ctx.accounts.vault_token_account.to_account_info(),
                        to:        ctx.accounts.fee_usdc_ata.to_account_info(),
                        authority: ctx.accounts.savings_vault.to_account_info(),
                    },
                    signer,
                ),
                fee,
            )?;
        }

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.vault_token_account.to_account_info(),
                    to:        ctx.accounts.sender_usdc_ata.to_account_info(),
                    authority: ctx.accounts.savings_vault.to_account_info(),
                },
                signer,
            ),
            sender_amount,
        )?;

        ctx.accounts.savings_vault.matured = true;
        emit!(VaultMatured {
            vault:          vault_key,
            sender:         sender_key,
            total_returned: sender_amount,
            yield_earned,
            protocol_fee:   fee,
        });
        Ok(())
    }

    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        emit!(PauseToggled { paused });
        Ok(())
    }

    pub fn update_fee_wallet(ctx: Context<AdminOnly>, new_fee_wallet: Pubkey) -> Result<()> {
        ctx.accounts.config.fee_wallet = new_fee_wallet;
        Ok(())
    }
}

// ── Account structs ───────────────────────────────────────────────────────────

#[account]
pub struct GlobalConfig {
    pub owner:     Pubkey,
    pub fee_wallet: Pubkey,
    pub bump:      u8,
    pub paused:    bool,
    pub _reserved: [u8; 64],
}

#[account]
pub struct Escrow {
    pub sender:           Pubkey,
    pub recipient:        Pubkey,
    pub amount_deposited: u64,
    pub yield_vehicle:    YieldVehicle,
    pub auto_release_ts:  i64,
    pub created_at:       i64,
    pub claimed:          bool,
    pub returned:         bool,
    pub bump:             u8,
    pub _reserved:        [u8; 32],
}

#[account]
pub struct SavingsVault {
    pub sender:           Pubkey,
    pub monthly_amount:   u64,
    pub duration_months:  u8,
    pub months_deposited: u8,
    pub total_deposited:  u64,
    pub yield_vehicle:    YieldVehicle,
    pub maturity_ts:      i64,
    pub created_at:       i64,
    pub matured:          bool,
    pub extended:         bool,
    pub bump:             u8,
    pub _reserved:        [u8; 32],
}

// ── Enums ─────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum YieldVehicle {
    Usdc,
    JupUsd,
    Juiced,
}

// ── Contexts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 32 + 1 + 1 + 64,
        seeds = [b"config"],
        bump,
    )]
    pub config:         Account<'info, GlobalConfig>,
    #[account(mut)]
    pub owner:          Signer<'info>,
    /// CHECK: fee wallet
    pub fee_wallet:     AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateDirectSend<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = sender,
        space = 8 + 32 + 32 + 8 + 1 + 8 + 8 + 1 + 1 + 1 + 32,
        seeds = [b"escrow", sender.key().as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init_if_needed,
        payer = sender,
        token::mint      = usdc_mint,
        token::authority = escrow,
        seeds = [b"escrow_vault", sender.key().as_ref()],
        bump,
    )]
    pub escrow_vault:    Account<'info, TokenAccount>,

    #[account(mut, token::mint = usdc_mint, token::authority = sender)]
    pub sender_usdc_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: mint
    pub usdc_mint:      AccountInfo<'info>,
    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent:           Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClaimDirectSend<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.sender.as_ref()],
        bump  = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [b"escrow_vault", escrow.sender.as_ref()],
        bump,
        token::mint      = usdc_mint,
        token::authority = escrow,
    )]
    pub escrow_vault:       Account<'info, TokenAccount>,

    #[account(mut, token::mint = usdc_mint)]
    pub recipient_usdc_ata: Account<'info, TokenAccount>,

    pub recipient: Signer<'info>,

    /// CHECK: mint
    pub usdc_mint:     AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReturnToSender<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.sender.as_ref()],
        bump  = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [b"escrow_vault", escrow.sender.as_ref()],
        bump,
        token::mint      = usdc_mint,
        token::authority = escrow,
    )]
    pub escrow_vault:    Account<'info, TokenAccount>,

    #[account(mut, token::mint = usdc_mint)]
    pub sender_usdc_ata: Account<'info, TokenAccount>,

    /// CHECK: permissionless crank
    pub cranker:    AccountInfo<'info>,
    /// CHECK: mint
    pub usdc_mint:  AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateSavingsVault<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = sender,
        space = 8 + 32 + 8 + 1 + 1 + 8 + 1 + 8 + 8 + 1 + 1 + 1 + 32,
        seeds = [b"vault", sender.key().as_ref()],
        bump,
    )]
    pub savings_vault: Account<'info, SavingsVault>,

    #[account(
        init_if_needed,
        payer = sender,
        token::mint      = usdc_mint,
        token::authority = savings_vault,
        seeds = [b"vault_token", sender.key().as_ref()],
        bump,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = usdc_mint, token::authority = sender)]
    pub sender_usdc_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: mint
    pub usdc_mint:      AccountInfo<'info>,
    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent:           Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DepositMonthly<'info> {
    #[account(
        mut,
        seeds   = [b"vault", savings_vault.sender.as_ref()],
        bump    = savings_vault.bump,
        has_one = sender,
    )]
    pub savings_vault: Account<'info, SavingsVault>,

    #[account(
        mut,
        seeds = [b"vault_token", sender.key().as_ref()],
        bump,
        token::mint      = usdc_mint,
        token::authority = savings_vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = usdc_mint, token::authority = sender)]
    pub sender_usdc_ata: Account<'info, TokenAccount>,

    pub sender: Signer<'info>,

    /// CHECK: mint
    pub usdc_mint:     AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ExtendVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", savings_vault.sender.as_ref()],
        bump  = savings_vault.bump,
    )]
    pub savings_vault: Account<'info, SavingsVault>,
    pub sender: Signer<'info>,
}

#[derive(Accounts)]
pub struct MatureVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", savings_vault.sender.as_ref()],
        bump  = savings_vault.bump,
    )]
    pub savings_vault: Account<'info, SavingsVault>,

    #[account(
        mut,
        seeds = [b"vault_token", savings_vault.sender.as_ref()],
        bump,
        token::mint      = usdc_mint,
        token::authority = savings_vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = usdc_mint)]
    pub sender_usdc_ata: Account<'info, TokenAccount>,

    #[account(mut, token::mint = usdc_mint)]
    pub fee_usdc_ata: Account<'info, TokenAccount>,

    /// CHECK: permissionless crank
    pub cranker:    AccountInfo<'info>,
    /// CHECK: mint
    pub usdc_mint:  AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(
        mut,
        seeds   = [b"config"],
        bump    = config.bump,
        has_one = owner,
    )]
    pub config: Account<'info, GlobalConfig>,
    pub owner:  Signer<'info>,
}

// ── Events ────────────────────────────────────────────────────────────────────

#[event] pub struct ConfigInitialized   { pub owner: Pubkey }
#[event] pub struct DirectSendCreated   { pub escrow: Pubkey, pub sender: Pubkey, pub recipient: Pubkey, pub amount: u64, pub release_ts: i64 }
#[event] pub struct DirectSendClaimed   { pub escrow: Pubkey, pub recipient: Pubkey, pub amount: u64 }
#[event] pub struct FundsReturnedToSender { pub escrow: Pubkey, pub sender: Pubkey, pub amount: u64 }
#[event] pub struct SavingsVaultCreated { pub vault: Pubkey, pub sender: Pubkey, pub monthly_amount: u64, pub duration_months: u8, pub maturity_ts: i64 }
#[event] pub struct MonthlyDeposit      { pub vault: Pubkey, pub month: u8, pub amount: u64, pub total: u64 }
#[event] pub struct VaultExtended       { pub vault: Pubkey, pub old_maturity: i64, pub new_maturity: i64, pub total_months: u8 }
#[event] pub struct VaultMatured        { pub vault: Pubkey, pub sender: Pubkey, pub total_returned: u64, pub yield_earned: u64, pub protocol_fee: u64 }
#[event] pub struct PauseToggled        { pub paused: bool }

// ── Errors ────────────────────────────────────────────────────────────────────

#[error_code]
pub enum JupRemitError {
    #[msg("Protocol is paused")]                  Paused,
    #[msg("Amount must be greater than zero")]     ZeroAmount,
    #[msg("Release timestamp is in the past")]     ReleaseInPast,
    #[msg("Release timestamp exceeds max hold")]   ReleaseTooLate,
    #[msg("Escrow already claimed")]               AlreadyClaimed,
    #[msg("Escrow already returned to sender")]    AlreadyReturned,
    #[msg("Caller is not the designated recipient")] NotRecipient,
    #[msg("Escrow has expired, use return_to_sender")] EscrowExpired,
    #[msg("Escrow has not expired yet")]           NotYetExpired,
    #[msg("Duration must be 1-5 months")]          InvalidDuration,
    #[msg("Vault has already matured")]            VaultMatured,
    #[msg("All months have already been deposited")] AllMonthsDeposited,
    #[msg("Vault maturity has not been reached yet")] NotYetMatured,
    #[msg("Vault is already past maturity")]       AlreadyMatured,
    #[msg("Only the vault owner can perform this action")] NotOwner,
}
