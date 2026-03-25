import { getBoards, addBoard } from "./services/sync.js";

export const state = {
  boards: [],
  currentBoardId: null,
};

export const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
];

export async function initializeState() {
  state.boards = await getBoards();

  if (state.boards.length === 0) {
    const defaultBoard = await addBoard("Main Board");
    state.boards = [defaultBoard];
  }

  state.currentBoardId = state.boards[0].id;
}
