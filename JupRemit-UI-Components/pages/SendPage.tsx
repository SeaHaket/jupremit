import React, { useState, useEffect } from 'react';
import { Numpad } from '../components/Numpad'; 
import AddressInput from '../components/AddressInput';

const COUNTRY_CONFIG = [
  { id: 'PH', name: 'Philippines', currency: 'PHP', flagEmoji: '🇵🇭', defaultProvider: 'Coins.ph' },
  { id: 'ID', name: 'Indonesia', currency: 'IDR', flagEmoji: '🇮🇩', defaultProvider: 'Bank Transfer' },
  { id: 'VN', name: 'Vietnam', currency: 'VND', flagEmoji: '🇻🇳', defaultProvider: 'Bank Transfer' },
  { id: 'TH', name: 'Thailand', currency: 'THB', flagEmoji: '🇹🇭', defaultProvider: 'Bank Transfer' },
  { id: 'MY', name: 'Malaysia', currency: 'MYR', flagEmoji: '🇲🇾', defaultProvider: 'Bank Transfer' },
  { id: 'SG', name: 'Singapore', currency: 'SGD', flagEmoji: '🇸🇬', defaultProvider: 'Bank Transfer' },
  { id: 'UK', name: 'UK', currency: 'GBP', flagEmoji: '🇬🇧', defaultProvider: 'Bank Transfer' },
  { id: 'US', name: 'USA', currency: 'USD', flagEmoji: '🇺🇸', defaultProvider: 'Bank Transfer' },
  { id: 'NG', name: 'Nigeria', currency: 'NGN', flagEmoji: '🇳🇬', defaultProvider: 'Bank Transfer' },
  { id: 'KE', name: 'Kenya', currency: 'KES', flagEmoji: '🇰🇪', defaultProvider: 'Bank Transfer' },
  { id: 'IN', name: 'India', currency: 'INR', flagEmoji: '🇮🇳', defaultProvider: 'Bank Transfer' },
  { id: 'BR', name: 'Brazil', currency: 'BRL', flagEmoji: '🇧🇷', defaultProvider: 'Pix' },
];

const USER_USDC_BALANCE = 100.00; 

export default function SendPage() {
  const [amount, setAmount] = useState<string>("0");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CONFIG[0]);
  const [fxRate, setFxRate] = useState<number>(0); 
  const [isFetchingFx, setIsFetchingFx] = useState<boolean>(false);
  
  // Validation state
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [isAddressValid, setIsAddressValid] = useState<boolean>(false);

  // CoinGecko API integration
  useEffect(() => {
    const fetchLiveFxRate = async () => {
      setIsFetchingFx(true);
      try {
        const targetCurrency = selectedCountry.currency.toLowerCase();
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=${targetCurrency}`
        );
        
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        const currentRate = data['usd-coin'][targetCurrency];
        
        if (currentRate) {
          setFxRate(currentRate);
        }
      } catch (error) {
        console.error("Failed to fetch FX rate", error);
        // Fallbacks
        const fallbackRates: Record<string, number> = { PHP: 56.40, IDR: 16120, VND: 25430 };
        if (fallbackRates[selectedCountry.currency]) {
          setFxRate(fallbackRates[selectedCountry.currency]);
        }
      } finally {
        setIsFetchingFx(false);
      }
    };

    fetchLiveFxRate();
  }, [selectedCountry.currency]);

  const handleInput = (val: string) => {
    if (val === "⌫") {
      setAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
      return;
    }
    if (val === "." && amount.includes(".")) return;
    setAmount((prev) => (prev === "0" && val !== "." ? val : prev + val));
  };

  const handleAction = (action: string) => {
    switch (action) {
      case "MAX": setAmount(USER_USDC_BALANCE.toString()); break;
      case "75%": setAmount((USER_USDC_BALANCE * 0.75).toFixed(2)); break;
      case "50%": setAmount((USER_USDC_BALANCE * 0.50).toFixed(2)); break;
      case "CLEAR": setAmount("0"); break;
    }
  };

  const numAmount = parseFloat(amount || "0");
  const estimatedOutput = (numAmount * fxRate).toLocaleString(undefined, { 
    minimumFractionDigits: 2, maximumFractionDigits: 2 
  });

  // Ensure amount > 0 and address is valid before enabling send
  const isSendEnabled = numAmount > 0 && numAmount <= USER_USDC_BALANCE && isAddressValid;

  return (
    <div className="min-h-screen bg-[#0b0e14] p-4 text-white font-sans flex flex-col items-center pt-6">
      
      {/* Header aligned for Overseas Workers */}
      <div className="w-full max-w-sm mb-4 text-center">
        <h2 className="text-[#24E5A5] font-semibold tracking-wide">JupRemit</h2>
        <p className="text-xs text-gray-400 mt-1">Seamless transfers for Overseas Workers</p>
      </div>

      <div className="w-full max-w-sm flex items-center justify-between bg-[#131823] p-3 rounded-full mb-6 border border-white/5">
        <span className="text-gray-400 text-sm ml-3">Sending to</span>
        <select 
          className="bg-transparent text-white font-semibold outline-none appearance-none cursor-pointer pr-4"
          value={selectedCountry.id}
          onChange={(e) => {
            const country = COUNTRY_CONFIG.find(c => c.id === e.target.value);
            if (country) setSelectedCountry(country);
          }}
        >
          {COUNTRY_CONFIG.map((c) => (
            <option key={c.id} value={c.id} className="bg-[#131823]">
              {c.name} ({c.currency})
            </option>
          ))}
        </select>
      </div>

      <div className="w-full max-w-sm bg-gradient-to-b from-[#1C212B] to-[#131823] rounded-3xl p-6 border border-white/5 shadow-xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#24E5A5] rounded-full blur-[80px] opacity-10"></div>

        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-2 bg-[#0b0e14]/50 py-1.5 px-3 rounded-full border border-white/5">
            <span className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-lg bg-[#1C212B]">
              {selectedCountry.flagEmoji}
            </span>
            <span className="text-sm font-medium">{selectedCountry.defaultProvider}</span>
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#24E5A5]"></span>
            USDC Balance: {USER_USDC_BALANCE.toFixed(2)}
          </div>
        </div>

        <div className="text-center my-8 relative z-10">
          <h1 className={`text-6xl font-semibold tracking-tighter ${amount === "0" ? 'text-gray-500' : 'text-white'}`}>
            <span className="text-3xl text-gray-400 mr-1">$</span>
            {amount}
          </h1>
          
          <div className="mt-4 flex flex-col items-center justify-center">
            <div className="text-xl font-medium text-[#24E5A5]">
              {isFetchingFx ? "Calculating..." : `≈ ${estimatedOutput} ${selectedCountry.currency}`}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {isFetchingFx ? "Fetching live rates..." : `1 USDC = ${fxRate} ${selectedCountry.currency}`}
            </div>
            <div className="text-[10px] text-gray-500 mt-2 opacity-70">
              Estimate only. Final received amount depends on provider's live exchange rate.
            </div>
          </div>
        </div>
      </div>

      <AddressInput onValidAddress={(addr, valid) => {
        setRecipientAddress(addr);
        setIsAddressValid(valid);
      }} />

      <button 
        className="w-full max-w-sm mt-6 py-4 bg-[#24E5A5] hover:bg-[#1fce93] text-[#0b0e14] font-bold rounded-2xl text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!isSendEnabled}
      >
        {numAmount > USER_USDC_BALANCE ? "Insufficient Balance" : 
         !isAddressValid ? "Enter Valid Solana Address" : 
         "Review Transfer"}
      </button>

      <Numpad onInput={handleInput} onAction={handleAction} />

    </div>
  );
}
