
import React, { useState, useEffect, useCallback } from 'react';
import { Problem, UserInput, ValidationResult } from './types';
import GridInput from './components/GridInput';

const App: React.FC = () => {
  const [problem, setProblem] = useState<Problem>({ num1: 0, num2: 0 });
  const [userInput, setUserInput] = useState<UserInput>({
    row1D: '', row1U: '',
    row2D: '', row2U: '',
    carry: '',
    resultH: '', resultD: '', resultU: ''
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const generateNewProblem = useCallback(() => {
    const n1 = Math.floor(Math.random() * 100); // 0-99
    const n2 = Math.floor(Math.random() * 5);   // 0-4
    
    setProblem({ num1: n1, num2: n2 });
    setUserInput({
      row1D: '', row1U: '',
      row2D: '', row2U: '',
      carry: '',
      resultH: '', resultD: '', resultU: ''
    });
    setValidation(null);
    setShowFeedback(false);
  }, []);

  useEffect(() => {
    generateNewProblem();
  }, [generateNewProblem]);

  const updateInput = (field: keyof UserInput, value: string) => {
    setUserInput(prev => ({ ...prev, [field]: value }));
    if (validation) setValidation(null);
  };

  const validate = () => {
    const fieldErrors: Partial<Record<keyof UserInput, boolean>> = {};
    const product = problem.num1 * problem.num2;
    
    // Decomposição do multiplicando (n1)
    const p1D = Math.floor(problem.num1 / 10).toString();
    const p1U = (problem.num1 % 10).toString();
    // Multiplicador (n2)
    const p2U = problem.num2.toString();

    // Verificação dos números base
    if (userInput.row1D !== (problem.num1 >= 10 ? p1D : '0') && userInput.row1D !== (problem.num1 >= 10 ? p1D : '')) fieldErrors.row1D = true;
    if (userInput.row1U !== p1U) fieldErrors.row1U = true;
    if (userInput.row2U !== p2U) fieldErrors.row2U = true;

    // Lógica do Transporte (Carry) na multiplicação:
    // É o valor que "sobe" da multiplicação das unidades: (U1 * U2) / 10
    const unitsProduct = (problem.num1 % 10) * problem.num2;
    const correctCarry = unitsProduct > 9 ? Math.floor(unitsProduct / 10).toString() : "";
    
    if (userInput.carry !== correctCarry) fieldErrors.carry = true;

    // Verificação do resultado final (H D U)
    const correctResU = (product % 10).toString();
    const correctResD = (Math.floor(product / 10) % 10).toString();
    const correctResH = Math.floor(product / 100) > 0 ? Math.floor(product / 100).toString() : "";

    if (userInput.resultU !== correctResU) fieldErrors.resultU = true;
    if (userInput.resultD !== (product >= 10 ? correctResD : '0') && userInput.resultD !== (product >= 10 ? correctResD : '')) fieldErrors.resultD = true;
    if (userInput.resultH !== correctResH) fieldErrors.resultH = true;

    const hasErrors = Object.keys(fieldErrors).length > 0;
    const errors: string[] = [];
    
    if (hasErrors) {
      if (fieldErrors.row1D || fieldErrors.row1U || fieldErrors.row2U) errors.push("Verifica os números da conta.");
      if (fieldErrors.carry) errors.push("O transporte não está correto.");
      if (fieldErrors.resultH || fieldErrors.resultD || fieldErrors.resultU) errors.push("O resultado final está errado.");
    }

    setValidation({ isValid: !hasErrors, errors, fieldErrors });
    setShowFeedback(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 bg-yellow-50 overflow-hidden">
      <header className="mb-2 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-orange-600">MULTIPLICAÇÃO</h1>
      </header>

      {/* Target Problem Display */}
      <div className="bg-black text-white rounded-lg px-6 py-2 mb-4 shadow-md">
        <span className="text-2xl md:text-3xl font-bold tracking-widest">
          {problem.num1} × {problem.num2} = ?
        </span>
      </div>

      {/* Multiplication Grid Algorithm */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-xl border-2 border-orange-100 select-none">
        <div className="flex space-x-2 md:space-x-4">
          
          {/* Sign column */}
          <div className="flex flex-col justify-center pt-14 md:pt-16">
            <span className="text-3xl font-bold text-gray-400">×</span>
          </div>

          {/* Hundreds Column (Only for Result) */}
          <div className="flex flex-col items-center space-y-2">
            <div className="w-full bg-blue-400 text-white font-bold py-0.5 rounded-t-lg text-center text-lg px-2">C</div>
            <div className="h-6 md:h-8"></div> {/* Carry spacer */}
            <div className="w-12 h-12 md:w-16 md:h-16"></div> {/* Row 1 spacer */}
            <div className="w-12 h-12 md:w-16 md:h-16"></div> {/* Row 2 spacer */}
            <div className="w-full border-t-4 border-gray-800 my-0.5"></div>
            <GridInput 
              variant="result" 
              value={userInput.resultH} 
              onChange={(v) => updateInput('resultH', v)} 
              isError={validation?.fieldErrors.resultH} 
            />
          </div>

          {/* Tens Column (Dezenas) */}
          <div className="flex flex-col items-center space-y-2">
            <div className="w-full bg-yellow-400 text-white font-bold py-0.5 rounded-t-lg text-center text-lg px-2">D</div>
            
            {/* Carry Box over Tens */}
            <div className="w-full flex justify-end pr-1 h-6 md:h-8">
              <GridInput 
                variant="carry" 
                value={userInput.carry} 
                onChange={(v) => updateInput('carry', v)}
                isError={validation?.fieldErrors.carry}
              />
            </div>

            <GridInput value={userInput.row1D} onChange={(v) => updateInput('row1D', v)} isError={validation?.fieldErrors.row1D} />
            <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-50 rounded-md border-2 border-dashed border-gray-200"></div>
            
            <div className="w-full border-t-4 border-gray-800 my-0.5"></div>
            
            <GridInput variant="result" value={userInput.resultD} onChange={(v) => updateInput('resultD', v)} isError={validation?.fieldErrors.resultD} />
          </div>

          {/* Units Column (Unidades) */}
          <div className="flex flex-col items-center space-y-2">
            <div className="w-full bg-green-500 text-white font-bold py-0.5 rounded-t-lg text-center text-lg px-2">U</div>
            
            <div className="h-6 md:h-8"></div>

            <GridInput value={userInput.row1U} onChange={(v) => updateInput('row1U', v)} isError={validation?.fieldErrors.row1U} />
            <GridInput value={userInput.row2U} onChange={(v) => updateInput('row2U', v)} isError={validation?.fieldErrors.row2U} />
            
            <div className="w-full border-t-4 border-gray-800 my-0.5"></div>
            
            <GridInput variant="result" value={userInput.resultU} onChange={(v) => updateInput('resultU', v)} isError={validation?.fieldErrors.resultU} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex space-x-3">
        <button 
          onClick={validate}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-xl shadow transition-transform active:scale-95 text-lg"
        >
          Verificar
        </button>
        <button 
          onClick={generateNewProblem}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-xl shadow transition-transform active:scale-95 text-lg"
        >
          Próxima
        </button>
      </div>

      {/* Feedback Area */}
      {showFeedback && validation && (
        <div className={`mt-3 max-w-sm w-full p-3 rounded-xl border-2 animate-pop-in ${validation.isValid ? 'bg-green-100 border-green-400 text-green-900' : 'bg-red-100 border-red-400 text-red-900'}`}>
          {validation.isValid ? (
            <div className="text-center">
              <span className="text-3xl block mb-1">🌟</span>
              <p className="text-lg font-bold">Excelente multiplicação!</p>
            </div>
          ) : (
            <div>
              <span className="text-base font-bold block mb-1">Tenta de novo:</span>
              <ul className="list-disc pl-5 text-sm">
                {validation.errors.map((err, i) => (
                  <li key={i} className="font-medium">{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pop-in {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop-in {
          animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .shake-animation {
          animation: shake 0.2s ease-in-out 2;
        }
      `}</style>
    </div>
  );
};

export default App;
