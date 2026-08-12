# SynapseVault: The Semantic Second Brain

SynapseVault is a personal knowledge graph system designed to interrelate ideas, projects, and tasks using a local-first architecture.

## Architecture
- **Storage**: PostgreSQL (Relational Graph Schema).
- **Logic**: Node.js MCP Gateway (standardized agentic interaction).
- **Interface**: React + D3.js Force-Directed Graph Dashboard.
- **Reasoning**: Vertex AI Reasoning Engine (optional) or local agent.

## Getting Started

### 🐳 The Fast Way (Docker)
Ensure you have Docker installed, then run:
```bash
docker-compose up --build
```
This will launch the database, API, and UI automatically.
- **UI**: http://localhost:5173
- **API**: http://localhost:3000

### 🛠️ The Manual Way (Local Development)
Ensure PostgreSQL is running locally, then initialize the schema:
```bash
./scripts/setup_local_db.sh
```

### 2. Run the MCP Gateway (API)
```bash
cd api
npm install
npm run build
npm start
```

### 3. Run the Visual Dashboard (UI)
```bash
cd ui
npm install
npm run dev
```

### 4. Deploy Reasoning Engine (Optional)
```bash
python3 scripts/deploy_agent.py
```

## Dashboard Features
- **Visual Graph**: Interactive D3-powered visualization of your second brain.
- **Node Categories**: 
  - 🔵 **Ideas**: Raw concepts and insights.
  - 🟢 **Projects**: Structured collections of work.
  - 🟠 **Tasks**: Actionable items.
- **Interrelation**: Direct visual mapping of how projects contain tasks and ideas relate to each other.

## License
MIT License. Created by Lucas Mulato.
