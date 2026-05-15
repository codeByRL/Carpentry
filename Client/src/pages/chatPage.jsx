import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  List,
  ListItemButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Badge,
  alpha,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

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
  selectChatLoading,
  selectChatError,
  selectSearchResults,
  selectSearchLoading,
  markRoomAsRead,
  fetchPartnerDetails,
} from "../store/slices/chatSlice";
import { selectUser } from "../store/slices/authSlice";
import { authService } from "../services/authService";
import { fetchNotifications } from "../store/slices/notificationsSlice";
import { chatSocketClient } from "../utils/ChatSocketClient";

/** פלטת בסגנון Gmail Chat */
const G = {
  listBg: "#f6f8fc",
  threadBg: "#f6f8fc",
  white: "#ffffff",
  hover: "#eef3f8",
  border: "#e0e0e0",
  divider: "#dadce0",
  textPrimary: "#202124",
  textSecondary: "#5f6368",
  otherBubble: "#ffffff",
  accent: "#1a73e8",
  compose: "#f1f3f4",
};

const ROLE_LABEL = {
  MANAGER: "מנהל",
  WAREHOUSE: "מחסנאי",
  SALES: "מכירות",
  CARPENTER: "נגר",
  DRIVER: "מוביל",
};

const formatListTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "אתמול";
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
};

const avatarColor = (id = "") => {
  const palette = ["#5D4037", "#6D4C41", "#8D6E63", "#A1887F", "#795548"];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

const ChatPage = () => {
  const { partnerId: urlPartnerId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  /** כתום מערכת (secondary) בשקיפות עדינה */
  const accent = useMemo(
    () => ({
      selected: alpha(theme.palette.secondary.main, 0.12),
      selectedHover: alpha(theme.palette.secondary.main, 0.2),
      ownBubble: alpha(theme.palette.secondary.main, 0.1),
      ownBorder: alpha(theme.palette.secondary.main, 0.22),
    }),
    [theme]
  );

  const currentUserFromRedux = useSelector(selectUser);
  const currentUserFromStorage = authService.getCurrentUser();
  const currentUser = currentUserFromRedux || currentUserFromStorage;
  const authToken = useSelector((state) => state.auth.token) || authService.getToken();
  const currentUserId = currentUser?.id || currentUser?._id;

  const activePartnerId = useSelector((state) => state.chat.activePartnerId);
  const activeChatPartnerDetails = useSelector((state) => state.chat.activeChatPartnerDetails);
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
  const [listSearch, setListSearch] = useState("");
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
      dispatch(markChatMessagesAsRead(urlPartnerId))
        .unwrap()
        .then(() => {
          dispatch(fetchNotifications());
          dispatch(fetchActiveChatPartners());
        })
        .catch(() => {});
      dispatch(markRoomAsRead(urlPartnerId));
    }
  }, [authToken, urlPartnerId, dispatch]);

  useEffect(() => {
    if (activePartnerId && activePartnerId !== "undefined" && activePartnerId !== urlPartnerId) {
      dispatch(fetchChatHistory(activePartnerId));
      dispatch(markChatMessagesAsRead(activePartnerId))
        .unwrap()
        .then(() => {
          dispatch(fetchNotifications());
          dispatch(fetchActiveChatPartners());
        })
        .catch(() => {});
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
    if (!currentMessageContent.trim() || !currentUserId || !activePartnerId || activePartnerId === "undefined") {
      return;
    }
    const content = currentMessageContent.trim();
    const sentViaSocket = chatSocketClient.sendMessage({
      receiverId: activePartnerId,
      content,
      orderId: null,
    });
    if (sentViaSocket) {
      setCurrentMessageContent("");
      return;
    }
    dispatch(sendChatMessage({ receiverId: activePartnerId, content, orderId: null }))
      .unwrap()
      .then(() => setCurrentMessageContent(""))
      .catch((err) => console.error("Failed to send message:", err));
  };

  const handleSelectPartner = (id) => {
    if (id && id !== "undefined") {
      navigate(`/chat/${id}`, { replace: true });
      dispatch(setActivePartner(id));
      setTimeout(() => {
        setShowNewChatPanel(false);
        dispatch(clearSearchResults());
        setSearchRole("");
      }, 100);
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

  const getPartnerId = (partner) =>
    partner?.partnerId || partner?._id || partner?.partner?._id;

  const isOwnMessage = (message) => {
    if (!message?.sender) return false;
    if (typeof message.sender === "object" && message.sender._id) {
      return message.sender._id === currentUserId;
    }
    return message.sender === currentUserId;
  };

  const conversations = useMemo(() => {
    const seen = new Set();
    const rows = [];

    (activeChatPartners || []).forEach((p) => {
      const id = getPartnerId(p);
      if (!id || id === "undefined" || id === currentUserId || seen.has(id)) return;
      seen.add(id);
      rows.push({
        id,
        name: getPartnerDisplayName(p),
        preview: p.lastMessage || "אין הודעות עדיין",
        time: p.lastUpdate,
        unread: unreadCounts[id] || p.unreadCount || 0,
        role: p.partnerRole || p.role,
        hasChat: true,
      });
    });

    (staffList || []).forEach((p) => {
      const id = getPartnerId(p);
      if (!id || id === "undefined" || id === currentUserId || seen.has(id)) return;
      seen.add(id);
      rows.push({
        id,
        name: getPartnerDisplayName(p),
        preview: ROLE_LABEL[p.role] || p.role || "צוות",
        time: null,
        unread: unreadCounts[id] || 0,
        role: p.role,
        hasChat: false,
      });
    });

    rows.sort((a, b) => {
      if (a.unread !== b.unread) return b.unread - a.unread;
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return tb - ta;
    });

    const q = listSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [activeChatPartners, staffList, unreadCounts, currentUserId, listSearch]);

  if (!currentUser) {
    return (
      <Box sx={{ height: "50vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const showListPanel = isDesktop || !activePartnerId;
  const showChatPanel = isDesktop || !!activePartnerId;

  const partnerTitle =
    activeChatPartnerDetails?.fullName ||
    conversations.find((c) => c.id === activePartnerId)?.name ||
    "טוען...";

  const getMessageSenderLabel = (message, isUser) => {
    if (isUser) return "אני";
    if (typeof message?.sender === "object" && message.sender?.fullName) {
      return message.sender.fullName;
    }
    return partnerTitle !== "טוען..." ? partnerTitle : "נמען";
  };

  const renderConversationRow = (row) => {
    const selected = activePartnerId === row.id;
    return (
      <ListItemButton
        key={row.id}
        onClick={() => handleSelectPartner(row.id)}
        selected={selected}
        sx={{
          py: 1.25,
          px: 2,
          gap: 1.5,
          alignItems: "flex-start",
          bgcolor: selected ? accent.selected : "transparent",
          borderBottom: `1px solid ${G.divider}`,
          "&:hover": { bgcolor: selected ? accent.selectedHover : G.hover },
          "&.Mui-selected": { bgcolor: accent.selected },
          "&.Mui-selected:hover": { bgcolor: accent.selectedHover },
        }}
      >
        <Badge
          badgeContent={row.unread}
          color="error"
          overlap="circular"
          invisible={!row.unread}
          sx={{ "& .MuiBadge-badge": { fontSize: 10, minWidth: 18, height: 18 } }}
        >
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: avatarColor(row.id),
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {row.name?.[0] || "?"}
          </Avatar>
        </Badge>
        <Box sx={{ flex: 1, minWidth: 0, textAlign: "right" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "baseline" }}>
            <Typography
              sx={{
                fontWeight: row.unread ? 700 : 500,
                fontSize: 14,
                color: G.textPrimary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {row.name}
            </Typography>
            {row.time && (
              <Typography sx={{ fontSize: 11, color: G.textSecondary, flexShrink: 0 }}>
                {formatListTime(row.time)}
              </Typography>
            )}
          </Box>
          <Typography
            sx={{
              fontSize: 13,
              color: row.unread ? G.textPrimary : G.textSecondary,
              fontWeight: row.unread ? 600 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              mt: 0.25,
            }}
          >
            {row.preview}
          </Typography>
        </Box>
      </ListItemButton>
    );
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        direction: "rtl",
        height: { xs: "min(78dvh, 640px)", md: "calc(100dvh - 56px - 48px)" },
        minHeight: { xs: 420, md: 480 },
        mx: { xs: -1.5, sm: -2.5 },
        mb: { xs: -1, sm: -1 },
        border: `1px solid ${G.border}`,
        borderRadius: { xs: 2, md: 3 },
        overflow: "hidden",
        bgcolor: G.white,
        boxShadow: "0 1px 3px rgba(60,64,67,0.15)",
      }}
    >
      {/* רשימת שיחות — כמו Gmail */}
      <Box
        sx={{
          width: { xs: "100%", md: 360 },
          maxWidth: "100%",
          flexShrink: 0,
          display: showListPanel ? "flex" : "none",
          flexDirection: "column",
          bgcolor: G.listBg,
          borderLeft: { md: `1px solid ${G.border}` },
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1,
            bgcolor: G.white,
            borderBottom: `1px solid ${G.divider}`,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: G.textPrimary, flex: 1 }}>
            צ׳אט
          </Typography>
          <IconButton
            size="small"
            onClick={() => setShowNewChatPanel((v) => !v)}
            sx={{
              bgcolor: showNewChatPanel ? accent.selected : G.compose,
              "&:hover": { bgcolor: G.hover },
            }}
            aria-label={showNewChatPanel ? "סגור חיפוש אנשי קשר" : "חיפוש אנשי קשר"}
          >
            {showNewChatPanel ? <CloseIcon fontSize="small" /> : <SearchIcon fontSize="small" />}
          </IconButton>
        </Box>

        <Box sx={{ px: 1.5, py: 1, bgcolor: G.white, borderBottom: `1px solid ${G.divider}` }}>
          <TextField
            fullWidth
            size="small"
            placeholder="חיפוש בשיחות"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
                bgcolor: G.compose,
                fontSize: 14,
                "& fieldset": { border: "none" },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 20, color: G.textSecondary }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {showNewChatPanel && (
          <Box sx={{ px: 1.5, py: 1.5, bgcolor: G.white, borderBottom: `1px solid ${G.divider}` }}>
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel id="search-role-label">תפקיד</InputLabel>
              <Select
                labelId="search-role-label"
                value={searchRole}
                label="תפקיד"
                onChange={(e) => setSearchRole(e.target.value)}
                sx={{ borderRadius: 2, bgcolor: G.compose }}
              >
                <MenuItem value="">
                  <em>כל התפקידים</em>
                </MenuItem>
                <MenuItem value="MANAGER">מנהל</MenuItem>
                <MenuItem value="WAREHOUSE">מחסנאי</MenuItem>
                <MenuItem value="SALES">מכירות</MenuItem>
                <MenuItem value="CARPENTER">נגר</MenuItem>
                <MenuItem value="DRIVER">מוביל</MenuItem>
              </Select>
            </FormControl>
            {searchLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                <CircularProgress size={22} />
              </Box>
            ) : (
              <List dense disablePadding sx={{ maxHeight: 160, overflowY: "auto" }}>
                {searchResults.map((u) => (
                  <ListItemButton key={u._id} onClick={() => handleSelectPartner(u._id)} sx={{ borderRadius: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, ml: 1, bgcolor: avatarColor(u._id), fontSize: 13 }}>
                      {u.fullName?.[0]}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{u.fullName}</Typography>
                      <Typography sx={{ fontSize: 12, color: G.textSecondary }}>
                        {ROLE_LABEL[u.role] || u.role}
                      </Typography>
                    </Box>
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        )}

        <List dense disablePadding sx={{ flex: 1, overflowY: "auto", py: 0 }}>
          {conversations.length === 0 ? (
            <Typography sx={{ p: 3, textAlign: "center", color: G.textSecondary, fontSize: 14 }}>
              {listSearch ? "לא נמצאו שיחות" : "אין שיחות — התחילי שיחה חדשה"}
            </Typography>
          ) : (
            conversations.map(renderConversationRow)
          )}
        </List>
      </Box>

      {/* חלון שיחה */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: showChatPanel ? "flex" : "none",
          flexDirection: "column",
          bgcolor: G.threadBg,
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: "flex",
            alignItems: "center",
            gap: 1,
            bgcolor: G.white,
            borderBottom: `1px solid ${G.divider}`,
            minHeight: 56,
          }}
        >
          {!isDesktop && activePartnerId && (
            <IconButton size="small" onClick={() => navigate("/chat")} aria-label="חזרה לרשימה">
              <ArrowForwardIcon />
            </IconButton>
          )}
          {activePartnerId ? (
            <>
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: avatarColor(activePartnerId),
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {partnerTitle?.[0] || "?"}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: G.textPrimary }} noWrap>
                  {partnerTitle}
                </Typography>
                <Typography sx={{ fontSize: 12, color: G.textSecondary }}>צ׳אט ישיר</Typography>
              </Box>
            </>
          ) : (
            <Typography sx={{ fontSize: 15, color: G.textSecondary, flex: 1 }}>
              בחרו שיחה מהרשימה
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            px: { xs: 1.5, sm: 2.5 },
            py: 2,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {!activePartnerId ? (
            <Box sx={{ m: "auto", textAlign: "center", py: 6 }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 72, color: alpha(G.accent, 0.35), mb: 2 }} />
              <Typography sx={{ color: G.textSecondary, fontSize: 15 }}>
                בחרו איש צוות מהרשימה כדי להתחיל לשוחח
              </Typography>
            </Box>
          ) : (
            <>
              {chatLoading && (
                <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
                  <CircularProgress size={24} sx={{ color: G.accent }} />
                </Box>
              )}
              {chatError && (
                <Typography sx={{ textAlign: "center", color: "error.main", my: 2, fontSize: 14 }}>
                  שגיאה בטעינת שיחה: {chatError}
                </Typography>
              )}
              {currentPartnerMessages.map((msg, index) => {
                const isUser = isOwnMessage(msg);
                const showDateDivider =
                  index === 0 ||
                  new Date(msg.createdAt).toDateString() !==
                    new Date(currentPartnerMessages[index - 1]?.createdAt).toDateString();

                return (
                  <React.Fragment key={msg._id || `msg-${index}`}>
                    {showDateDivider && msg.createdAt && (
                      <Box sx={{ display: "flex", justifyContent: "center", my: 1.5 }}>
                        <Typography
                          sx={{
                            fontSize: 11,
                            color: G.textSecondary,
                            bgcolor: G.compose,
                            px: 1.5,
                            py: 0.35,
                            borderRadius: 1,
                          }}
                        >
                          {new Date(msg.createdAt).toLocaleDateString("he-IL", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </Typography>
                      </Box>
                    )}
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isUser ? "flex-start" : "flex-end",
                        mb: 1,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: isUser ? theme.palette.secondary.dark : G.textSecondary,
                          mb: 0.35,
                          px: 0.5,
                        }}
                      >
                        {getMessageSenderLabel(msg, isUser)}
                      </Typography>
                      <Box
                        sx={{
                          maxWidth: { xs: "88%", sm: "72%" },
                          px: 1.75,
                          py: 1,
                          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          bgcolor: isUser ? accent.ownBubble : G.otherBubble,
                          color: G.textPrimary,
                          border: isUser ? `1px solid ${accent.ownBorder}` : `1px solid ${G.divider}`,
                          boxShadow: isUser ? "none" : "0 1px 2px rgba(60,64,67,0.12)",
                        }}
                      >
                        <Typography sx={{ fontSize: 14.5, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                          {msg.content}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 11,
                            color: G.textSecondary,
                            textAlign: "left",
                            mt: 0.5,
                            display: "block",
                          }}
                        >
                          {msg.createdAt
                            ? new Date(msg.createdAt).toLocaleTimeString("he-IL", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </Typography>
                      </Box>
                    </Box>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </Box>

        {activePartnerId && (
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: G.white,
              borderTop: `1px solid ${G.divider}`,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-end",
                gap: 0.5,
                bgcolor: G.compose,
                borderRadius: 3,
                px: 1.5,
                py: 0.75,
              }}
            >
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder="כתבו הודעה..."
                value={currentMessageContent}
                onChange={(e) => setCurrentMessageContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                variant="standard"
                InputProps={{
                  disableUnderline: true,
                  sx: { fontSize: 14, py: 0.5 },
                }}
              />
              <IconButton
                onClick={handleSendMessage}
                disabled={!currentMessageContent.trim()}
                sx={{
                  color: currentMessageContent.trim() ? G.accent : G.textSecondary,
                }}
                aria-label="שליחה"
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ChatPage;