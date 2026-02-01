
export interface Problem {
  num1: number;
  num2: number;
}

export interface UserInput {
  row1D: string;
  row1U: string;
  row2D: string; // Não será usado na multiplicação (multiplicador 0-9)
  row2U: string;
  carry: string;
  resultH: string;
  resultD: string;
  resultU: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  fieldErrors: Partial<Record<keyof UserInput, boolean>>;
}
