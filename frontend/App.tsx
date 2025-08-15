import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import VoiceCalendarApp from "./src/components/VoiceCalendarApp";

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <VoiceCalendarApp />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
