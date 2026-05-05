import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Box,
  Typography,
  TextField,
  Paper,
  InputAdornment,
  IconButton,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChatIcon from "@mui/icons-material/Chat";
import CircleIcon from "@mui/icons-material/Circle";
import ClearIcon from "@mui/icons-material/Clear";
import AddCommentIcon from "@mui/icons-material/AddComment";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

import {
  fetchChatHistory,
  sendChatMessage,
  setActivePartner,
  markChatMessagesAsRead,
  fetchActiveChatPartners,
  fetchStaffListSimple,
  searchUsers,
  clearSearchResults,
  selectMessagesForPartner,
  selectUnreadCounts,
  selectActiveChatPartners,
  selectStaffList,
  selectActiveChatPartnerDetails,
  selectChatLoading,
  selectChatError,
  selectSearchResults,
  selectSearchLoading,
  markRoomAsRead,
  fetchPartnerDetails,
} from "../store/slices/chatSlice";
import { selectUser } from "../store/slices/authSlice";
import { authService } from "../services/authService";

const ChatPage = () => {
  const { partnerId: urlPartnerId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();

  const currentUserFromRedux = useSelector(selectUser);
  const currentUserFromStorage = authService.getCurrentUser();
  const currentUser = currentUserFromRedux || currentUserFromStorage;
  const authToken = useSelector((state) => state.auth.token) || authService.getToken();

  if (!currentUser) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">טוען משתמש...</Typography>
      </Box>
    );
  }

  const currentUserId = currentUser.id || currentUser._id;

  const activePartnerId = useSelector((state) => state.chat.activePartnerId);
  const activeChatPartnerDetails = useSelector(
    (state) => state.chat.activeChatPartnerDetails
  );
  const currentPartnerMessages = useSelector(selectMessagesForPartner);
  const unreadCounts = useSelector(selectUnreadCounts);
  const activeChatPartners = useSelector(selectActiveChatPartners);
  const staffList = useSelector(selectStaffList);
  const chatLoading = useSelector(selectChatLoading);
  const chatError = useSelector(selectChatError);
  const searchResults = useSelector(selectSearchResults);
  const searchLoading = useSelector(selectSearchLoading);

  const [currentMessageContent, setCurrentMessageContent] = useState("");
  const [searchRole, setSearchRole] = useState("");
  const [showNewChatPanel, setShowNewChatPanel] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (authToken) {
      dispatch(fetchActiveChatPartners());
      dispatch(fetchStaffListSimple());
    }

    if (urlPartnerId && urlPartnerId !== "undefined" && authToken) {
      dispatch(setActivePartner(urlPartnerId));
      dispatch(fetchChatHistory(urlPartnerId));
      dispatch(markChatMessagesAsRead(urlPartnerId));
      dispatch(markRoomAsRead(urlPartnerId));
    }
  }, [authToken, urlPartnerId, dispatch]);

  useEffect(() => {
    if (
      activePartnerId &&
      activePartnerId !== "undefined" &&
      activePartnerId !== urlPartnerId
    ) {
      dispatch(fetchChatHistory(activePartnerId));
      dispatch(markChatMessagesAsRead(activePartnerId));
      dispatch(markRoomAsRead(activePartnerId));
    }
  }, [activePartnerId, dispatch, urlPartnerId]);

  useEffect(() => {
    if (activePartnerId) {
      dispatch(fetchPartnerDetails(activePartnerId));
    } else {
      dispatch(fetchPartnerDetails(null));
    }
  }, [activePartnerId, dispatch]);

  useEffect(() => {
    scrollToBottom();
  }, [currentPartnerMessages, scrollToBottom]);

  useEffect(() => {
    if (showNewChatPanel) {
      dispatch(searchUsers({ query: "", role: searchRole }));
    } else {
      dispatch(clearSearchResults());
    }
  }, [searchRole, dispatch, showNewChatPanel]);

  const handleSendMessage = () => {
    if (
      currentMessageContent.trim() &&
      currentUserId &&
      activePartnerId &&
      activePartnerId !== "undefined"
    ) {
      dispatch(
        sendChatMessage({
          receiverId: activePartnerId,
          content: currentMessageContent.trim(),
          orderId: null,
        })
      )
        .unwrap()
        .then(() => {
          setCurrentMessageContent("");
        })
        .catch((err) => {
          console.error("Failed to send message:", err);
        });
    }
  };

  const handleSelectPartner = (id) => {
    if (id && id !== "undefined") {
      // 1. קודם כל מבצעים ניווט לכתובת החדשה, זה יעדכן את ה-URL
      navigate(`/chat/${id}`, { replace: true });
      
      // 2. מעדכנים את הפרטנר הפעיל ברדוקס
      dispatch(setActivePartner(id));
      
      // 3. מנקים את החיפוש בתוך setTimeout קצר
      // זה מונע מה-useEffect של החיפוש לגרום לרינדור מחדש בעייתי באותו רגע
      // כמו כן, מסיים את פאנל יצירת הצ'אט החדש
      setTimeout(() => {
        setShowNewChatPanel(false);
        dispatch(clearSearchResults());
        setSearchRole("");
      }, 100); // השהיה קצרה של 100 מילישניות
    }
  };

  const getPartnerDisplayName = (partner) => {
    if (!partner) return "משתמש לא ידוע";
    return (
      partner.fullName ||
      partner.partnerName ||
      (partner.partner && partner.partner.fullName) ||
      "משתמש לא ידוע"
    );
  };

  // מותר לכולם ליזום שיחה חדשה (כמו מנהל)
  const canInitiateNewChat = true; 

  const renderPartnerList = (partners, title, typeColor, type) => (
    <Box sx={{ mb: 3 }} key={`box-${type}-${title}`}>
      <Typography
        variant="h6"
        sx={{ mb: 1, color: typeColor || theme.palette.primary.main }}
      >
        {title}
      </Typography>
      <List dense disablePadding sx={{ maxHeight: 200, overflowY: "auto" }}>
        {(!partners || partners.length === 0) ? (
          <ListItem key={`no-${type}-${title}`}>
            <ListItemText secondary={`אין ${title.toLowerCase()} זמינים.`} />
          </ListItem>
        ) : (
          partners
            .filter(partner => {
              const partnerId = partner.partnerId || partner._id || (partner.partner && partner.partner._id);
              return partnerId !== currentUserId;
            })
            .map((partner) => {
              const id = partner.partnerId || partner._id || (partner.partner && partner.partner._id);
              if (!id || id === "undefined" || id === currentUserId) return null;

              const unread = unreadCounts[id] || 0;
              return (
                <React.Fragment key={`frag-${id}`}>
                  <ListItem
                    key={`item-${id}`}
                    component="button"
                    onClick={() => handleSelectPartner(id)}
                    selected={activePartnerId === id}
                    sx={{
                      borderRadius: theme.shape.borderRadius,
                      mb: 0.5,
                      textAlign: "right",
                      bgcolor: activePartnerId === id ? theme.palette.action.selected : "transparent",
                      "&:hover": {
                        bgcolor: activePartnerId === id ? theme.palette.action.selected : theme.palette.action.hover,
                      },
                    }}
                  >
                    <ListItemText
                      primary={getPartnerDisplayName(partner)}
                      secondary={
                        type === "active" && partner.lastMessage ? (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {partner.lastMessage}
                          </Typography>
                        ) : partner.role ? (
                          <Typography variant="body2" color="text.secondary">
                            {partner.role}
                          </Typography>
                        ) : null
                      }
                    />
                    {unread > 0 && (
                      <CircleIcon
                        sx={{ fontSize: 10, color: theme.palette.warning.main, ml: 1 }}
                      />
                    )}
                  </ListItem>
                  <Divider component="li" key={`div-${id}`} />
                </React.Fragment>
              );
            })
        )}
      </List>
    </Box>
  );

  const isOwnMessage = (message) => {
    if (!message || !message.sender) return false;
    if (typeof message.sender === "object" && message.sender._id) {
      return message.sender._id === currentUserId;
    }
    return message.sender === currentUserId;
  };

  const getSenderName = (message) => {
    if (!message || !message.sender) return "משתמש";
    if (typeof message.sender === "object" && message.sender.fullName) {
      return message.sender.fullName;
    }
    return isOwnMessage(message) ? "אתה" : "משתמש";
  };

  return (
    <Box
      sx={{
        display: "flex",
        height: "calc(100vh - 64px)",
        bgcolor: theme.palette.background.default,
        p: 2,
        direction: "rtl",
      }}
    >
      <Paper
        elevation={3}
        sx={{
          width: 350,
          ml: 2,
          borderRadius: 3,
          display: "flex",
          flexDirection: "column",
          p: 2,
        }}
      >
        <Typography
          variant="h5"
          sx={{ mb: 2, fontWeight: "bold", display: "flex", alignItems: "center" }}
        >
          <ChatIcon sx={{ ml: 1 }} />
          שיחות
          <IconButton
            color="primary"
            onClick={() => setShowNewChatPanel(!showNewChatPanel)}
            sx={{ mr: "auto" }}
          >
            {showNewChatPanel ? <ClearIcon /> : <AddCommentIcon />}
          </IconButton>
        </Typography>

        {showNewChatPanel && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel id="search-role-label">סנן לפי תפקיד</InputLabel>
              <Select
                labelId="search-role-label"
                value={searchRole}
                label="סנן לפי תפקיד"
                onChange={(e) => setSearchRole(e.target.value)}
              >
                <MenuItem value="">
                  <em>כל התפקידים</em>
                </MenuItem>
                {/* רשימת תפקידים מלאה לכולם (כמו מנהל) */}
                <MenuItem value="MANAGER">מנהל</MenuItem>
                <MenuItem value="WAREHOUSE">מחסנאי</MenuItem>
                <MenuItem value="SALES">מכירות</MenuItem>
                <MenuItem value="CARPENTER">נגר</MenuItem>
                <MenuItem value="DRIVER">נהג</MenuItem>
              </Select>
            </FormControl>

            {searchLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 1 }}>
                <CircularProgress size={20} />
              </Box>
            ) : (
              searchResults.length > 0 && (
                <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
                  {searchResults.map((user) => (
                    <ListItem
                      key={`sr-${user._id}`}
                      component="button"
                      onClick={() => handleSelectPartner(user._id)}
                    >
                      <ListItemText primary={user.fullName} secondary={user.role} />
                    </ListItem>
                  ))}
                </List>
              )
            )}
          </Box>
        )}

        <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
          {activeChatPartners.length > 0 &&
            renderPartnerList(activeChatPartners, "שיחות קיימות", theme.palette.primary.main, "active")}
          {staffList.length > 0 &&
            renderPartnerList(staffList, "צוות זמין", theme.palette.secondary.main, "staff")}
        </Box>
      </Paper>

      <Paper
        elevation={3}
        sx={{
          flexGrow: 1,
          borderRadius: 3,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            p: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          {activePartnerId ? (
            <>
              <IconButton onClick={() => navigate("/chat")} sx={{ ml: 1 }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: "bold", flexGrow: 1 }}>
                {activeChatPartnerDetails?.fullName || "טוען..."}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <CircleIcon sx={{ fontSize: 12, color: "success.main", ml: 1 }} />
                <Typography variant="caption">מחובר</Typography>
              </Box>
            </>
          ) : (
            <Typography variant="h6" color="text.secondary">
              בחר/י שיחה
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            p: 2,
            overflowY: "auto",
            bgcolor: "#f5f5f5",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {activePartnerId ? (
            <>
              {chatLoading && (
                <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {chatError && (
                <Typography color="error" sx={{ textAlign: "center", my: 2 }}>
                  שגיאה בטעינת שיחה: {chatError}
                </Typography>
              )}
              {currentPartnerMessages.map((msg, index) => {
                const isUser = isOwnMessage(msg);
                return (
                  <Box
                    key={`msg-${msg._id || index}`}
                    sx={{
                      display: "flex",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                      mb: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: "70%",
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: isUser ? theme.palette.primary.main : "white",
                        color: isUser ? "white" : "black",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      }}
                    >
                      {!isUser && (
                        <Typography variant="caption" sx={{ fontWeight: "bold", display: "block", mb: 0.5 }}>
                          {getSenderName(msg)}
                        </Typography>
                      )}
                      <Typography variant="body1">{msg.content}</Typography>
                      <Typography variant="caption" sx={{ display: "block", textAlign: "left", mt: 0.5, opacity: 0.7 }}>
                        {msg.createdAt
                          ? new Date(msg.createdAt).toLocaleTimeString("he-IL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <Box sx={{ m: "auto", textAlign: "center" }}>
              <ChatIcon sx={{ fontSize: 60, color: "divider", mb: 2 }} />
              <Typography color="text.secondary">אין שיחה פעילה</Typography>
            </Box>
          )}
        </Box>

        {activePartnerId && (
          <Box sx={{ p: 2, bgcolor: "white", display: "flex", alignItems: "center" }}>
            <TextField
              fullWidth
              placeholder="הקלד/י הודעה..."
              value={currentMessageContent}
              onChange={(e) => setCurrentMessageContent(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleSendMessage}
                      color="primary"
                      disabled={!currentMessageContent.trim()}
                    >
                      <SendIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ChatPage;