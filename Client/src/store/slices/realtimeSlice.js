import { createSlice } from "@reduxjs/toolkit";

const realtimeSlice = createSlice({
  name: "realtime",
  initialState: {
    /** מונה שעולה בכל אירוע order:updated או polling — מסכים מאזינים ומרעננים */
    ordersTick: 0,
    socketConnected: false,
  },
  reducers: {
    bumpOrdersTick: (state) => {
      state.ordersTick += 1;
    },
    setSocketConnected: (state, action) => {
      state.socketConnected = action.payload;
    },
  },
});

export const { bumpOrdersTick, setSocketConnected } = realtimeSlice.actions;
export default realtimeSlice.reducer;
