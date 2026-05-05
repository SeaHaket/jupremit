import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';

interface AddressInputProps {
  onValidAddress: (address: string, isValid: boolean) => void;
}

export default function AddressInput({ onValidAddress }: AddressInputProps) {
  const [address, setAddress] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const validateSolanaAddress = (inputAddress: string) => {
    setAddress(inputAddress);

    if (inputAddress.trim() === '') {
      setIsValid(null);
      setErrorMessage('');
      onValidAddress('', false);
      return;
    }

    try {
      // 1. Check if valid cryptographic Solana Public Key
      const pubKey = new PublicKey(inputAddress);
      
      // 2. Check if it is a standard user wallet address (on-curve)
      const isUserWallet = PublicKey.isOnCurve(pubKey.toBytes());

      if (!isUserWallet) {
        setIsValid(false);
        setErrorMessage('Warning: This is a smart contract, not a standard wallet.');
        onValidAddress(inputAddress, false);
        return;
      }

      setIsValid(true);
      setErrorMessage('');
      onValidAddress(inputAddress, true);

    } catch (error) {
      setIsValid(false);
      setErrorMessage('Invalid Solana address format.');
      onValidAddress(inputAddress, false);
    }
  };

  return (
    <div className="w-full max-w-sm mt-6 relative">
      <label className="text-xs font-semibold text-gray-400 mb-2 block tracking-wider uppercase">
        Recipient Solana Address
      </label>
      
      <div className="relative">
        <input
          type="text"
          value={address}
          onChange={(e) => validateSolanaAddress(e.target.value)}
          placeholder="e.g. 7xKX..."
          className={`w-full bg-[#131823] text-white p-4 rounded-2xl outline-none border transition-colors ${
            isValid === true 
              ? 'border-[#24E5A5]/50 focus:border-[#24E5A5]' 
              : isValid === false 
                ? 'border-red-500/50 focus:border-red-500' 
                : 'border-white/5 focus:border-white/20'
          }`}
        />
        
        {isValid && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24E5A5]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {isValid === false && (
        <p className="text-red-400 text-xs mt-2 ml-1">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
