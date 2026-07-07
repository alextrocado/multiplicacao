# 🧮 Multiplicação — treino do algoritmo (1.º ciclo)

Aplicação web para treinar o **algoritmo da multiplicação** no 1.º ciclo do ensino
básico, com o **quadradinho do transporte** sempre presente e muito feedback para
o aluno evoluir.

🔗 **Online:** https://multiplicacao-seven-blue.vercel.app

## Funcionalidades

- **Definições integradas** (sem janelas à parte), simples de usar pelo aluno.
- **Nível por tabuada:** o professor/aluno escolhe até que tabuada trabalhar (×2 a ×9),
  conforme o ano e o nível. O nível aplica-se de imediato.
- **Multiplicar por unidades** (×2…×N) ou **por dezenas** (multiplicador de 2 algarismos,
  com duas parcelas e soma).
- **Quadradinho do transporte** 🟨 sempre presente e verificado — na multiplicação e na soma.
- **Muito feedback:** cores por quadradinho (verde/vermelho), mensagens de incentivo,
  **dica**, **passo a passo** animado, pontos, sequência e medalhas.
- **Teclado no ecrã** para tablet, além do teclado físico.
- Guarda o nível e a pontuação no navegador (localStorage).

## Como correr localmente

Não precisa de instalação nem de build — são ficheiros estáticos.

```bash
# a partir da pasta do projeto
python3 -m http.server 4321
# depois abrir http://localhost:4321
```

Ou simplesmente abrir o `index.html` num navegador.

## Estrutura

| Ficheiro | Descrição |
|----------|-----------|
| `index.html` | Estrutura da página |
| `styles.css` | Aspeto (cores, grelha da conta, animações) |
| `app.js` | Lógica: geração das contas, algoritmo com transporte, verificação e feedback |

## Publicar (Vercel)

```bash
vercel deploy --prod --yes
```

## Autor

Desenvolvido por **Alexandre Trocado** — [mail@alexandretrocado.com](mailto:mail@alexandretrocado.com)
