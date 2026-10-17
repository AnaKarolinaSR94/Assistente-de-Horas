# Banco de Horas

App para registrar horas trabalhadas por serviço e gerar a ficha de horas em PDF no fim do mês.
Funciona offline no iPhone (PWA) e guarda os dados só no aparelho.

## Como publicar no GitHub Pages (uma vez só)

1. Crie uma conta gratuita em github.com e clique em **New repository**.
2. Dê um nome (ex.: `banco-de-horas`), deixe **Public** e crie.
3. Na página do repositório, clique em **uploading an existing file**.
4. Arraste para lá **tudo que está dentro da pasta descompactada** (`index.html`, `app.js`, `style.css`, `logic.js`, `report.js`, `sw.js`, `manifest.webmanifest`, e as pastas `lib` e `icons`). O `index.html` precisa ficar na raiz do repositório, não dentro de outra pasta. Clique em **Commit changes**.
5. Vá em **Settings → Pages**. Em **Build and deployment**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve.
6. Espere 1 a 3 minutos. O endereço aparece nessa mesma tela: `https://SEU-USUARIO.github.io/banco-de-horas/`.

## Como instalar no iPhone

1. Abra o endereço no **Safari** (precisa ser o Safari).
2. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início**.
3. Abra pelo **ícone novo** e use sempre por ele. Os dados do Safari e os do app instalado são separados, então não lance horas antes de instalar.

Depois da primeira abertura, o app funciona sem internet.

## Cuidados

- Faça backup em **Ajustes → Salvar backup** (guarde no iCloud ou mande para você mesma). Se o app for apagado ou o celular trocado, sem backup as horas somem.
- Para atualizar o app: troque os arquivos no GitHub. Ao abrir o app com internet, ele se atualiza sozinho (na segunda abertura). Para forçar, mude o número de `VERSION` no `sw.js`.
- O repositório público mostra só o código do app. As horas dela nunca vão para o GitHub.
