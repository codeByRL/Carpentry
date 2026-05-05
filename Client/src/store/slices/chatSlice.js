import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import API from "../../services/api";
import { authService } from "../../services/authService";

const initialState = {
  activePartnerId: null,
  activeChatPartnerDetails: null,
  messages: {},
  unreadMessagesCount: {},
  activeChatPartners: [],
  staffList: [],
  searchResults: [],
  chatLoading: false,
  chatError: null,
  searchLoading: false,
  searchError: null,
};

// 🔧 עוזר לקבלת userId
const getUserIdFromAuth = () => {
  try {
    const user = authService.getCurrentUser();
    return user ? user.id || user._id : null;
  } catch (e) {
    return null;
  }
};

// 🆕 Thunk חדש: טעינת עובדים פשוטה
export const fetchStaffListSimple = createAsyncThunk(
  "chat/fetchStaffListSimple",
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get("/chat/staff");
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

// 🆕 Thunk חדש: שליחת הודעה פשוטה
export const sendSimpleMessage = createAsyncThunk(
  "chat/sendSimpleMessage",
  async ({ receiverId, content }, { rejectWithValue }) => {
    try {
      if (!receiverId || receiverId === "undefined") {
        throw new Error("receiverId חסר");
      }
      const response = await API.post("/chat/simple-send", { receiverId, content });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

// Thunks קיימים (מתוקנים)
export const fetchPartnerDetails = createAsyncThunk(
  "chat/fetchPartnerDetails",
  async (partnerId, { rejectWithValue }) => {
    try {
      if (!partnerId || partnerId === "undefined") {
        return rejectWithValue("Partner ID חסר");
      }
      const response = await API.get(`/users/${partnerId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const searchUsers = createAsyncThunk(
  "chat/searchUsers",
  async ({ query, role }, { rejectWithValue }) => {
    try {
      const response = await API.get(`/chat/search-users`, { params: { query, role } });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const fetchChatHistory = createAsyncThunk(
  "chat/fetchChatHistory",
  async (partnerId, { rejectWithValue }) => {
    try {
      if (!partnerId || partnerId === "undefined") {
        console.error("fetchChatHistory: partnerId חסר");
        return rejectWithValue("Partner ID חסר");
      }
      const response = await API.get(`/chat/history/${partnerId}`);
      return { partnerId, messages: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const fetchActiveChatPartners = createAsyncThunk(
  "chat/fetchActiveChatPartners",
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get("/chat/my-chats");
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const sendChatMessage = createAsyncThunk(
  "chat/sendChatMessage",
  async ({ receiverId, content, orderId }, { rejectWithValue }) => {
    try {
      if (!receiverId || receiverId === "undefined") throw new Error("receiverId חסר");
      const response = await API.post("/chat/message", { receiverId, content, orderId });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const markChatMessagesAsRead = createAsyncThunk(
  "chat/markChatMessagesAsRead",
  async (partnerId, { rejectWithValue, dispatch }) => {
    try {
      if (!partnerId || partnerId === "undefined") return;
      await API.get(`/chat/history/${partnerId}`);
      dispatch(chatSlice.actions.markRoomAsRead(partnerId));
      return partnerId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setActivePartner: (state, action) => {
      const pId = action.payload;
      if (!pId || pId === "undefined") return;

      state.activePartnerId = pId;

      // חיפוש ב-3 מקומות
      const found = 
        state.activeChatPartners.find(p => p.partnerId === pId || p._id === pId) ||
        state.searchResults.find(p => p._id === pId) ||
        state.staffList.find(p => p._id === pId);

      if (found) {
        state.activeChatPartnerDetails = {
          _id: found.partnerId || found._id,
          fullName: found.fullName || found.partnerName || "משתמש",
          role: found.role || "",
        };
      } else {
        state.activeChatPartnerDetails = { _id: pId, fullName: "טוען...", role: "" };
      }
    },
    
    setActiveChatPartnerDetails: (state, action) => {
      state.activeChatPartnerDetails = action.payload;
    },
    
    addMessage: (state, action) => {
      const message = action.payload;
      const partnerId = message.receiver?._id || message.receiver || message.partnerId;
      if (!partnerId || !state.messages[partnerId]) return;
      
      if (!state.messages[partnerId].some(m => m._id === message._id)) {
        state.messages[partnerId].push(message);
      }
    },
    
    markMessagesAsReadLocally: (state, action) => {
      const { senderId } = action.payload;
      if (senderId) state.unreadMessagesCount[senderId] = 0;
    },
    
    markRoomAsRead: (state, action) => {
      const partnerId = action.payload;
      if (partnerId) state.unreadMessagesCount[partnerId] = 0;
    },
    
    setActiveChatPartners: (state, action) => {
      state.activeChatPartners = action.payload;
    },
    
    setStaffList: (state, action) => {
      state.staffList = action.payload;
    },
    
    setSearchResults: (state, action) => {
      state.searchResults = action.payload;
    },
    
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    
    resetChatState: (state) => {
      Object.assign(state, initialState);
    },
  },
  
  extraReducers: (builder) => {
    builder
      // 🆕 טעינת עובדים פשוטה
      .addCase(fetchStaffListSimple.pending, (state) => {
        state.searchLoading = true;
      })
      .addCase(fetchStaffListSimple.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.staffList = action.payload;
      })
      .addCase(fetchStaffListSimple.rejected, (state, action) => {
        state.searchLoading = false;
        state.searchError = action.payload;
      })
      
      // 🆕 שליחת הודעה פשוטה ✅
      .addCase(sendSimpleMessage.fulfilled, (state, action) => {
        const message = action.payload;
        const partnerId = message.receiver?._id || message.receiver;
        if (!state.messages[partnerId]) state.messages[partnerId] = [];
        state.messages[partnerId].push(message);
      })
      
      // ✅ שליחת הודעה רגילה - סנכרון מיידי
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        const message = action.payload;
        const partnerId = message.receiver?._id || message.receiver;
        if (!state.messages[partnerId]) state.messages[partnerId] = [];
        state.messages[partnerId].push(message);
      })
      
      // חיפוש משתמשים
      .addCase(searchUsers.pending, (state) => {
        state.searchLoading = true;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.searchLoading = false;
        state.searchError = action.payload;
      })
      
      // היסטוריית שיחה
      .addCase(fetchChatHistory.pending, (state) => {
        state.chatLoading = true;
      })
      .addCase(fetchChatHistory.fulfilled, (state, action) => {
        state.chatLoading = false;
        const { partnerId, messages } = action.payload;
        state.messages[partnerId] = messages;
      })
      .addCase(fetchChatHistory.rejected, (state, action) => {
        state.chatLoading = false;
        state.chatError = action.payload;
      })
      
      // שיחות פעילות
      .addCase(fetchActiveChatPartners.fulfilled, (state, action) => {
        state.activeChatPartners = action.payload;
      })
      
      // פרטי שותף
      .addCase(fetchPartnerDetails.fulfilled, (state, action) => {
        state.activeChatPartnerDetails = action.payload;
      })
      .addCase(fetchPartnerDetails.rejected, (state, action) => {
        state.activeChatPartnerDetails = null;
      });
  },
});

// 🛠️ סלקטורים מתוקנים
const selectChatMessages = (state) => state.chat.messages;
const selectCurrentActivePartnerId = (state) => state.chat.activePartnerId;

export const selectMessagesForPartner = createSelector(
  [selectChatMessages, selectCurrentActivePartnerId],
  (messages, activePartnerId) => messages[activePartnerId] || []
);

export const selectActiveChatPartners = (state) => state.chat.activeChatPartners;
export const selectStaffList = (state) => state.chat.staffList;
export const selectActivePartnerId = (state) => state.chat.activePartnerId;
export const selectActiveChatPartnerDetails = (state) => state.chat.activeChatPartnerDetails;
export const selectSearchResults = (state) => state.chat.searchResults;
export const selectChatLoading = (state) => state.chat.chatLoading;
export const selectChatError = (state) => state.chat.chatError;
export const selectSearchLoading = (state) => state.chat.searchLoading;
export const selectUnreadCounts = (state) => state.chat.unreadMessagesCount;
export const selectCurrentUserId = () => getUserIdFromAuth();

export const {
  setActivePartner,
  setActiveChatPartnerDetails,
  addMessage,
  markMessagesAsReadLocally,
  markRoomAsRead,
  setActiveChatPartners,
  setStaffList,
  setSearchResults,
  clearSearchResults,
  resetChatState,
} = chatSlice.actions;

export default chatSlice.reducer;