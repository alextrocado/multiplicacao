
import React from 'react';

interface GridInputProps {
  value: string;
  onChange: (val: string) => void;
  isError?: boolean;
  placeholder?: string;
  variant?: 'normal' | 'carry' | 'result';
  disabled?: boolean;
}

const GridInput: React.FC<GridInputProps> = ({ 
  value, 
  onChange, 
  isError, 
  placeholder = "", 
  variant = 'normal',
  disabled = false
}) => {
  const baseClasses = "text-center font-bold rounded-md transition-all outline-none border-2";
  
  const variantClasses = {
    normal: "w-12 h-12 md:w-16 md:h-16 text-2xl bg-white border-gray-300 focus:border-blue-500",
    carry: "w-6 h-6 md:w-8 md:h-8 text-sm md:text-base text-red-600 border-red-300 bg-red-50 focus:border-red-500 rounded-md",
    result: "w-12 h-12 md:w-16 md:h-16 text-2xl bg-blue-50 border-blue-200 text-blue-700 focus:border-blue-500"
  };

  const errorClasses = isError ? "border-red-500 bg-red-100 shake-animation" : "";

  return (
    <input
      type="text"
      maxLength={1}
      value={value}
      onChange={(e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        onChange(val);
      }}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${errorClasses}`}
      placeholder={placeholder}
    />
  );
};

export default GridInput;
