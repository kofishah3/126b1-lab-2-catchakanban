# Catcha Kanban Board

## Lab Exercise 1: Dynamic UI, DOM API, LocalStorage

### Project Structure

```
catcha-kanban/
├── utils/
|   ├── dom-utils.js
├── styles.css
├── src/
│   ├── main.js
|   ├── api/
|       └── storage.js
│   └── components/
│       ├── kanban-board-modal/
│           ├── kanban-board-modal.css
|           ├── kanban-board-modal.html
│           └── kanban-board-modal.js
|       ├── kanban-column/
│           ├── kanban-column.css
|           ├── kanban-column.html
│           └── kanban-column.js
|       ├── task-card/
│           ├── task-card.css
|           ├── task-card.html
│           └── task-card.js
|       └── task-modal/
│           ├── task-modal.css
|           ├── task-modal.html
│           └── task-modal.js
        └── delete-modal/
│           ├── delete-modal.css
|           ├── delete-modal.html
│           └── delete-modal.js
├── .gitignore
├──  README.md
└── index.html       # Open with Live Server to run
```

### How to set-up

#### 1. Database Setup (PostgreSQL)

1. Install PostgreSQL on your computer.
2. Open your terminal in this project's folder.
3. Run the following command to automatically create the database and tables:
   ```bash
   psql -U postgres -f database_schema.sql
   ```
   _(It will prompt you different stuff, just click enter for defaults until you are asked to input password, then type `Templado2003`)._
4. _(Note: If your local postgres password is not `Templado2003`, update `db.js` before running the app!)_

#### 2. App Setup

1. Clone this repository: `git clone https://github.com/kofishah3/126b1-lab-2-catchakanban.git`
2. Open the folder in VS Code.
3. Open a terminal and run `npm install` to install backend dependencies.
4. Run `node server.js` to start the backend.
5. In your file explorer, right-click `index.html` and select **Open with Live Server**.

### Keyboard shortcuts

1. Alt + s -> focus sidebar
2. Alt + h -> focus header
3. Alt + b -> new board
4. Alt + n -> new task

### Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- LocalStorage API
- DOM APIs

### Submitted By:

- Max Lennon Limpag
- John Carlo Sandro
- Selena Therese Malig
- Isabella Nicole Recilla
- Ishah Nicholei Bautista

https://github.com/user-attachments/assets/584dcc69-6b1b-4332-8ec1-e3c233642007
