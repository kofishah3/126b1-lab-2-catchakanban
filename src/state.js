import { getBoards, addBoard } from "./services/sync.js";

export const state = {
  boards: getBoards(),
  currentBoardId: null,
};

if (state.boards.length === 0) {
  const defaultBoard = addBoard("Main Board");
  state.boards = [defaultBoard];
}

state.currentBoardId = state.boards[0].id;

export const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
];
