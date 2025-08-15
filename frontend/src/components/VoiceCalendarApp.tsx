import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  FlatList,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Types
interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  attendees: string[];
  location?: string;
  status: string;
}

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  snippet: string;
  isUnread: boolean;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  type?: "text" | "calendar" | "email";
}

interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

const { width, height } = Dimensions.get("window");

const VoiceCalendarApp: React.FC = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  // App state
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  // Data state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // UI state
  const [showCalendar, setShowCalendar] = useState(false);
  const [showEmails, setShowEmails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const API_BASE_URL = "http://localhost:3000/api";

  // Initialize the app
  useEffect(() => {
    initializeApp();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Initialize app and check authentication
  const initializeApp = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Check for stored auth token
      const token = await AsyncStorage.getItem("authToken");
      if (token) {
        setAuthToken(token);
        await verifyToken(token);
      }
    } catch (error) {
      console.error("App initialization error:", error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Verify stored token
  const verifyToken = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setIsAuthenticated(true);
        await loadDashboardData(token);

        // Add welcome message
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          text: `Hello ${data.user.name}! I'm your AI voice assistant. I can help you manage your calendar and emails. Try saying something like "What meetings do I have today?" or "Send an email to John about the project."`,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      } else {
        await AsyncStorage.removeItem("authToken");
        setAuthToken(null);
      }
    } catch (error) {
      console.error("Token verification error:", error);
      await AsyncStorage.removeItem("authToken");
      setAuthToken(null);
    }
  };

  // Google OAuth authentication
  const authenticateWithGoogle = async () => {
    try {
      setIsAuthenticating(true);

      // Get Google OAuth URL
      const response = await fetch(`${API_BASE_URL}/auth/google`);
      const data = await response.json();

      if (data.success) {
        // In a real app, you would open a web browser or WebView to handle OAuth
        // For demo purposes, we'll show an alert with instructions
        Alert.alert(
          "Google Authentication",
          "Please visit the following URL to authenticate:\n\n" + data.authUrl,
          [
            {
              text: "I've completed authentication",
              onPress: () => promptForAuthCode(),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Authentication error:", error);
      Alert.alert("Error", "Failed to start authentication process");
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Prompt user for auth code (in real app, this would be handled automatically)
  const promptForAuthCode = () => {
    Alert.prompt(
      "Enter Authorization Code",
      "Please enter the authorization code from Google:",
      async (code) => {
        if (code) {
          await exchangeAuthCode(code);
        }
      }
    );
  };

  // Exchange authorization code for tokens
  const exchangeAuthCode = async (code: string) => {
    try {
      setIsAuthenticating(true);

      const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setAuthToken(data.token);
        setIsAuthenticated(true);

        // Store token for future use
        await AsyncStorage.setItem("authToken", data.token);

        await loadDashboardData(data.token);

        // Add welcome message
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          text: `Welcome ${data.user.name}! I've successfully connected to your Google account. I can now help you manage your calendar and emails. What would you like to do?`,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      } else {
        Alert.alert("Error", data.error || "Authentication failed");
      }
    } catch (error) {
      console.error("Token exchange error:", error);
      Alert.alert("Error", "Failed to complete authentication");
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Load dashboard data
  const loadDashboardData = async (token: string) => {
    try {
      setIsLoadingData(true);

      const response = await fetch(`${API_BASE_URL}/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setDashboardData(data.dashboard);
        setEvents(data.data.todayEvents.concat(data.data.weekEvents));
        setEmails(data.data.recentEmails);
      }
    } catch (error) {
      console.error("Dashboard loading error:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Refresh data
  const refreshData = async () => {
    if (!authToken) return;

    setRefreshing(true);
    await loadDashboardData(authToken);
    setRefreshing(false);
  };

  // Voice Recording Functions
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Please grant microphone permission"
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingOptions = {
        android: {
          extension: ".m4a",
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(recording);
      setIsListening(true);
    } catch (error) {
      console.error("Failed to start recording", error);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setIsListening(false);
      setRecording(null);

      if (uri) {
        await processVoiceInput(uri);
      }
    } catch (error) {
      console.error("Failed to stop recording", error);
      Alert.alert("Error", "Failed to stop recording");
    }
  };

  // Process voice input with authentication
  const processVoiceInput = async (audioUri: string) => {
    if (!authToken) return;

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("audio", {
        uri: audioUri,
        type: "audio/m4a",
        name: "recording.m4a",
      } as any);

      const response = await fetch(`${API_BASE_URL}/voice/process`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const data = await response.json();

      if (data.success) {
        const userMessage: Message = {
          id: Date.now().toString(),
          text: data.transcription,
          isUser: true,
          timestamp: new Date(),
        };

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          isUser: false,
          timestamp: new Date(),
          type: data.action?.type || "text",
        };

        setMessages((prev) => [...prev, userMessage, assistantMessage]);

        // Refresh data if action was performed
        if (data.actionResult) {
          await refreshData();
        }

        // Speak the response
        if (data.response) {
          Speech.speak(data.response, {
            language: "en",
            pitch: 1.0,
            rate: 0.9,
          });
        }
      } else {
        throw new Error(data.error || "Failed to process voice input");
      }
    } catch (error) {
      console.error("Voice processing error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I had trouble processing your voice command. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle text input with authentication
  const handleTextSubmit = async () => {
    if (!textInput.trim() || !authToken) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textInput,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setTextInput("");

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: textInput,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        isUser: false,
        timestamp: new Date(),
        type: data.action?.type || "text",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Refresh data if action was performed
      if (data.actionResult) {
        await refreshData();
      }
    } catch (error) {
      console.error("Text processing error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await AsyncStorage.removeItem("authToken");
      setIsAuthenticated(false);
      setUser(null);
      setAuthToken(null);
      setMessages([]);
      setEvents([]);
      setEmails([]);
      setDashboardData(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Authentication screen
  if (!isAuthenticated) {
    return (
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
        <View style={styles.authContainer}>
          <Text style={styles.authTitle}>Voice Calendar Assistant</Text>
          <Text style={styles.authSubtitle}>
            Connect your Google account to start managing your calendar and
            emails with voice commands
          </Text>

          {isAuthenticating ? (
            <ActivityIndicator
              size="large"
              color="white"
              style={styles.loader}
            />
          ) : (
            <TouchableOpacity
              style={styles.authButton}
              onPress={authenticateWithGoogle}
            >
              <Text style={styles.authButtonText}>
                🔗 Connect Google Account
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    );
  }

  // Render functions
  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.isUser ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          item.isUser ? styles.userMessageText : styles.assistantMessageText,
        ]}
      >
        {item.text}
      </Text>
      <Text
        style={[
          styles.timestamp,
          item.isUser ? styles.userTimestamp : styles.assistantTimestamp,
        ]}
      >
        {item.timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );

  const renderEvent = ({ item }: { item: CalendarEvent }) => (
    <View style={styles.eventCard}>
      <Text style={styles.eventTitle}>{item.title}</Text>
      <Text style={styles.eventDescription}>{item.description}</Text>
      <Text style={styles.eventDate}>
        {new Date(item.startDate).toLocaleDateString()} at{" "}
        {new Date(item.startDate).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
      {item.location && (
        <Text style={styles.eventLocation}>📍 {item.location}</Text>
      )}
      {item.attendees.length > 0 && (
        <Text style={styles.eventAttendees}>
          👥 {item.attendees.length} attendee
          {item.attendees.length > 1 ? "s" : ""}
        </Text>
      )}
    </View>
  );

  const renderEmail = ({ item }: { item: EmailMessage }) => (
    <View style={[styles.emailCard, item.isUnread && styles.unreadEmail]}>
      <View style={styles.emailHeader}>
        <Text style={styles.emailFrom}>{item.from}</Text>
        <Text style={styles.emailDate}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.emailSubject}>{item.subject}</Text>
      <Text style={styles.emailSnippet}>{item.snippet}</Text>
      {item.isUnread && (
        <View style={styles.unreadIndicator}>
          <Text style={styles.unreadText}>UNREAD</Text>
        </View>
      )}
    </View>
  );

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      {/* Header with user info and dashboard stats */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Voice Assistant</Text>
          <Text style={styles.headerSubtitle}>
            {user?.name} • {dashboardData?.todayEvents || 0} events today
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowEmails(true)}
          >
            <Text style={styles.headerButtonText}>
              📧 {dashboardData?.unreadEmails || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowCalendar(true)}
          >
            <Text style={styles.headerButtonText}>📅</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={logout}>
            <Text style={styles.headerButtonText}>⏻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Messages */}
      <View style={styles.chatContainer}>
        <FlatList
          ref={scrollViewRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshData}
              tintColor="white"
            />
          }
        />

        {isProcessing && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}
      </View>

      {/* Input Section */}
      <View style={styles.inputContainer}>
        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            value={textInput}
            onChangeText={setTextInput}
            placeholder="Type your message..."
            placeholderTextColor="#999"
            multiline
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleTextSubmit}
            disabled={!textInput.trim()}
          >
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>

        {/* Voice Button */}
        <TouchableOpacity
          style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
          onPress={isListening ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          <Text style={styles.voiceButtonText}>{isListening ? "⏹" : "🎤"}</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Calendar Events</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCalendar(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={events}
              keyExtractor={(item) => item.id}
              renderItem={renderEvent}
              style={styles.eventsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No events found</Text>
              }
            />

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshData}
            >
              <Text style={styles.refreshButtonText}>Refresh Events</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Emails Modal */}
      <Modal
        visible={showEmails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEmails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recent Emails</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowEmails(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={emails}
              keyExtractor={(item) => item.id}
              renderItem={renderEmail}
              style={styles.emailsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No emails found</Text>
              }
            />

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshData}
            >
              <Text style={styles.refreshButtonText}>Refresh Emails</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginBottom: 20,
  },
  authSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  authButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  authButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  loader: {
    marginTop: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.2)",
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginLeft: 10,
  },
  headerButtonText: {
    fontSize: 16,
    color: "white",
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  messagesList: {
    flex: 1,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: "80%",
    padding: 12,
    borderRadius: 18,
  },
  userMessage: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignSelf: "flex-end",
    marginLeft: "20%",
  },
  assistantMessage: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "flex-start",
    marginRight: "20%",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#333",
  },
  assistantMessageText: {
    color: "white",
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  userTimestamp: {
    color: "#666",
  },
  assistantTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  processingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  processingText: {
    color: "white",
    fontStyle: "italic",
    marginLeft: 10,
  },
  inputContainer: {
    padding: 15,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    flexDirection: "row",
    alignItems: "flex-end",
  },
  textInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    fontSize: 16,
    color: "#333",
  },
  sendButton: {
    padding: 5,
    marginLeft: 5,
  },
  sendButtonText: {
    fontSize: 20,
    color: "#667eea",
  },
  voiceButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  voiceButtonActive: {
    backgroundColor: "#ff4757",
    borderColor: "#ff4757",
  },
  voiceButtonText: {
    fontSize: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: "#666",
  },
  eventsList: {
    flex: 1,
  },
  emailsList: {
    flex: 1,
  },
  eventCard: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    marginVertical: 5,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#667eea",
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  eventDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  eventDate: {
    fontSize: 12,
    color: "#888",
    marginBottom: 5,
  },
  eventLocation: {
    fontSize: 12,
    color: "#555",
    marginBottom: 5,
  },
  eventAttendees: {
    fontSize: 12,
    color: "#555",
    fontStyle: "italic",
  },
  emailCard: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    marginVertical: 5,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#28a745",
  },
  unreadEmail: {
    backgroundColor: "#e8f5e8",
    borderLeftColor: "#ffc107",
  },
  emailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  emailFrom: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  emailDate: {
    fontSize: 12,
    color: "#888",
  },
  emailSubject: {
    fontSize: 14,
    color: "#333",
    marginBottom: 5,
  },
  emailSnippet: {
    fontSize: 12,
    color: "#666",
    lineHeight: 16,
  },
  unreadIndicator: {
    backgroundColor: "#ffc107",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 5,
  },
  unreadText: {
    fontSize: 10,
    color: "#333",
    fontWeight: "bold",
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    fontSize: 16,
    marginTop: 20,
  },
  refreshButton: {
    backgroundColor: "#667eea",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
  },
  refreshButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default VoiceCalendarApp;
