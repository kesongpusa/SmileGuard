/* eslint-disable react/react-in-jsx-scope */
import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, SafeAreaView, ActivityIndicator
} from "react-native";
import { saveAppointment, Appointment } from "../../lib/database.ts";
import { getAllBlockedSlots, BlockedSlot } from "../../lib/appointmentService.ts";

const SERVICES = [
  { id: "cleaning",   name: "Cleaning",               duration: 30,  price: 1500  },
  { id: "whitening",  name: "Whitening",               duration: 60,  price: 5000  },
  { id: "fillings",   name: "Fillings",                duration: 45,  price: 2000  },
  { id: "root-canal", name: "Root Canal",              duration: 90,  price: 8000  },
  { id: "extraction", name: "Extraction",              duration: 30,  price: 1500  },
  { id: "braces",     name: "Braces Consultation",     duration: 60,  price: 35000 },
  { id: "implants",   name: "Implants Consultation",   duration: 60,  price: 45000 },
  { id: "xray",       name: "X-Ray",                   duration: 15,  price: 500   },
  { id: "checkup",    name: "Check-up",                duration: 20,  price: 300   },
];

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

interface BookAppointmentProps {
  patientId: string;
  dentistId?: string;
  onSuccess?: (appointment: Appointment) => void;
  onCancel?: () => void;
}

export default function BookAppointment({
  patientId,
  dentistId,
  onSuccess,
  onCancel,
}: BookAppointmentProps) {
  const [selectedService, setSelectedService] = useState<typeof SERVICES[0] | null>(null);
  const [selectedDate, setSelectedDate]       = useState<string>("");
  const [selectedTime, setSelectedTime]       = useState<string>("");
  const [notes, setNotes]                     = useState<string>("");
  const [isBooking, setIsBooking]             = useState(false);
  const [blockedSlots, setBlockedSlots]       = useState<BlockedSlot[]>([]);
  const [loadingBlockedSlots, setLoadingBlockedSlots] = useState(true);
  const [fullyBookedDates, setFullyBookedDates]       = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAllBlockedSlots();
  }, []);

  const fetchAllBlockedSlots = async () => {
    setLoadingBlockedSlots(true);
    try {
      const slots = await getAllBlockedSlots();
      console.log("🔍 [DEBUG] Fetched blocked slots from Supabase:", slots);
      console.log(`📊 [DEBUG] Total blocked slots: ${slots.length}`);

      setBlockedSlots(slots);

      const dateCounts: Record<string, number> = {};
      for (const slot of slots) {
        dateCounts[slot.date] = (dateCounts[slot.date] ?? 0) + 1;
      }
      console.log("📅 [DEBUG] Booked slots per date:", dateCounts);

      const full = new Set(
        Object.entries(dateCounts)
          .filter(([, count]) => count >= TIME_SLOTS.length)
          .map(([date]) => date)
      );
      console.log("🚫 [DEBUG] Fully booked dates:", Array.from(full));

      setFullyBookedDates(full);
    } catch (error) {
      console.error("❌ [DEBUG] Error fetching blocked slots:", error);
      setBlockedSlots([]);
    } finally {
      setLoadingBlockedSlots(false);
    }
  };

  const isTaken = (date: string, time: string): boolean => {
    const taken = blockedSlots.some((slot) => slot.date === date && slot.time === time);
    console.log(`⏰ [DEBUG] Checking slot - Date: ${date}, Time: ${time}, Taken: ${taken}`);
    return taken;
  };

  const availableDates = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return date.toISOString().split("T")[0];
  });

  const getDayOfWeek = (dateStr: string) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[new Date(dateStr).getDay()];
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });

  const handleDateSelect = (date: string) => {
    console.log(`📍 [DEBUG] Selected date: ${date}`);
    console.log(`📍 [DEBUG] Blocked slots for this date:`, blockedSlots.filter(s => s.date === date));
    setSelectedDate(date);
    setSelectedTime("");
  };

  const handleBook = async () => {
    if (!selectedService) { Alert.alert("Error", "Please select a service.");  return; }
    if (!selectedDate)    { Alert.alert("Error", "Please select a date.");     return; }
    if (!selectedTime)    { Alert.alert("Error", "Please select a time.");     return; }

    console.log(`✅ [DEBUG] Attempting to book appointment:`);
    console.log(`   Service: ${selectedService.name}`);
    console.log(`   Date: ${selectedDate}`);
    console.log(`   Time: ${selectedTime}`);

    if (isTaken(selectedDate, selectedTime)) {
      console.warn(`⚠️ [DEBUG] Slot is taken! Aborting booking.`);
      Alert.alert("Not Available", "This slot was just taken. Please choose another.");
      return;
    }

    setIsBooking(true);
    try { 
      const appointmentData = {
        patient_id:       patientId,
        dentist_id:       dentistId || null,  // FIX: null instead of "" — empty string breaks UUID column
        service:          selectedService.name,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        status:           "scheduled" as const,
        notes,
      };

      console.log(`📤 [DEBUG] Sending appointment data to database:`, appointmentData);
      const result = await saveAppointment(appointmentData);
      console.log(`📥 [DEBUG] Booking result:`, result);

      if (result.success) {
        handleReset();
        onSuccess?.(result.data as Appointment);

        Alert.alert(
          "Appointment Booked!",
          `Service: ${selectedService.name}\nDate: ${formatDate(selectedDate)}\nTime: ${selectedTime}${result.offlineId ? "\n\nSaved offline. Will sync when connected." : ""}`
        );

        console.log(`🔄 [DEBUG] Refreshing blocked slots after successful booking...`);
        await fetchAllBlockedSlots();
      } else {
        console.error(`❌ [DEBUG] Booking failed:`, result.error);
        Alert.alert("Booking Failed", result.error || "Please try again.");
      }
    } catch (error) {
      console.error(`❌ [DEBUG] Unexpected error during booking:`, error);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setIsBooking(false);
    }
  };

  const handleReset = () => {
    setSelectedService(null);
    setSelectedDate("");
    setSelectedTime("");
    setNotes("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Book Appointment</Text>

        {/* Service Selection */}
        <Text style={styles.sectionTitle}>Select Service</Text>
        <View style={styles.serviceGrid}>
          {SERVICES.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={[styles.serviceCard, selectedService?.id === service.id && styles.serviceCardSelected]}
              onPress={() => setSelectedService(service)}
            >
              <Text style={[styles.serviceName, selectedService?.id === service.id && styles.serviceNameSelected]}>
                {service.name}
              </Text>
              <Text style={styles.serviceDuration}>{service.duration} mins</Text>
              <Text style={styles.servicePrice}>₱{service.price}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date Selection */}
        <Text style={[styles.sectionTitle, !selectedService && styles.disabledText]}>
          Select Date {!selectedService && "(Choose a service first)"}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.dateScroll, !selectedService && styles.disabledSection]}
        >
          {availableDates.map((date) => {
            const isFull = fullyBookedDates.has(date);
            return (
              <TouchableOpacity
                key={date}
                disabled={!selectedService || isFull}
                style={[
                  styles.dateCard,
                  selectedDate === date && styles.dateCardSelected,
                  (!selectedService || isFull) && styles.dateCardDisabled,
                ]}
                onPress={() => handleDateSelect(date)}
              >
                <Text style={[styles.dateDay, selectedDate === date && styles.dateTextSelected]}>
                  {getDayOfWeek(date)}
                </Text>
                <Text style={[styles.dateNumber, selectedDate === date && styles.dateTextSelected]}>
                  {new Date(date).getDate()}
                </Text>
                {isFull && <Text style={styles.fullText}>Full</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time Selection */}
        <Text style={[styles.sectionTitle, !selectedDate && styles.disabledText]}>
          Select Time {!selectedDate && "(Choose a date first)"}
        </Text>
        {loadingBlockedSlots ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingMessage}>Loading available slots...</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.timeScroll, !selectedDate && styles.disabledSection]}
          >
            {TIME_SLOTS.map((time) => {
              const taken = selectedDate ? isTaken(selectedDate, time) : false;
              return (
                <TouchableOpacity
                  key={time}
                  disabled={!selectedDate || taken}
                  style={[
                    styles.timeCard,
                    selectedTime === time && styles.timeCardSelected,
                    (taken || !selectedDate) && styles.timeCardDisabled,
                  ]}
                  onPress={() => setSelectedTime(time)}
                >
                  <Text style={[
                    styles.timeCardText,
                    selectedTime === time && styles.timeTextSelected,
                    taken && styles.timeCardTextDisabled,
                  ]}>
                    {time}
                  </Text>
                  {taken && <Text style={styles.unavailableText}>Unavailable</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Notes */}
        <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any special requests or medical conditions we should know about..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Summary */}
        {selectedService && selectedDate && selectedTime && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Appointment Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service:</Text>
              <Text style={styles.summaryValue}>{selectedService.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date:</Text>
              <Text style={styles.summaryValue}>{formatDate(selectedDate)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time:</Text>
              <Text style={styles.summaryValue}>{selectedTime}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration:</Text>
              <Text style={styles.summaryValue}>{selectedService.duration} minutes</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Estimated Cost:</Text>
              <Text style={styles.totalValue}>₱{selectedService.price}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bookButton, isBooking && styles.bookButtonDisabled]}
            onPress={handleBook}
            disabled={isBooking}
          >
            <Text style={styles.bookButtonText}>
              {isBooking ? "Booking..." : "Book Appointment"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: "#f5f7fb" },
  scrollView:          { flex: 1, padding: 20 },
  title:               { fontSize: 24, fontWeight: "bold", color: "#1a1a2e", marginBottom: 20 },
  sectionTitle:        { fontSize: 16, fontWeight: "600", color: "#1a1a2e", marginBottom: 12, marginTop: 20 },
  serviceGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  serviceCard:         { width: "30%", padding: 12, backgroundColor: "#fff", borderRadius: 10, borderWidth: 2, borderColor: "#e0e0e0", alignItems: "center" },
  serviceCardSelected: { borderColor: "#4CAF50", backgroundColor: "#e8f5e9" },
  serviceName:         { fontSize: 12, fontWeight: "600", color: "#1a1a2e", textAlign: "center" },
  serviceNameSelected: { color: "#4CAF50" },
  serviceDuration:     { fontSize: 10, color: "#666", marginTop: 4 },
  servicePrice:        { fontSize: 11, color: "#4CAF50", fontWeight: "600", marginTop: 4 },
  dateScroll:          { marginBottom: 10 },
  dateCard:            { width: 60, height: 70, backgroundColor: "#fff", borderRadius: 10, borderWidth: 2, borderColor: "#e0e0e0", alignItems: "center", justifyContent: "center", marginRight: 10 },
  dateCardSelected:    { borderColor: "#4CAF50", backgroundColor: "#e8f5e9" },
  dateCardDisabled:    { opacity: 0.5, backgroundColor: "#f5f5f5" },
  dateDay:             { fontSize: 12, color: "#666", fontWeight: "600" },
  dateNumber:          { fontSize: 18, fontWeight: "bold", color: "#1a1a2e", marginTop: 4 },
  dateTextSelected:    { color: "#4CAF50" },
  fullText:            { fontSize: 10, color: "#999", fontWeight: "600", marginTop: 2 },
  timeScroll:          { marginBottom: 10 },
  timeCard:            { width: 70, height: 70, backgroundColor: "#fff", borderRadius: 10, borderWidth: 2, borderColor: "#e0e0e0", alignItems: "center", justifyContent: "center", marginRight: 10 },
  timeCardSelected:    { borderColor: "#4CAF50", backgroundColor: "#e8f5e9" },
  timeCardDisabled:    { opacity: 0.5, backgroundColor: "#f5f5f5" },
  timeCardText:        { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  timeCardTextDisabled:{ color: "#999" },
  timeTextSelected:    { color: "#4CAF50" },
  unavailableText:     { fontSize: 9, color: "#999", fontWeight: "600", marginTop: 2 },
  loadingContainer:    { backgroundColor: "#fff", borderRadius: 10, borderWidth: 2, borderColor: "#e0e0e0", padding: 30, alignItems: "center", justifyContent: "center", minHeight: 100 },
  loadingMessage:      { fontSize: 14, color: "#666", marginTop: 15, textAlign: "center" },
  disabledSection:     { opacity: 0.5 },
  disabledText:        { color: "#999" },
  notesInput:          { backgroundColor: "#fff", borderRadius: 10, padding: 15, fontSize: 14, borderWidth: 1, borderColor: "#e0e0e0", minHeight: 100 },
  summaryCard:         { backgroundColor: "#fff", borderRadius: 10, padding: 20, marginTop: 20 },
  summaryTitle:        { fontSize: 16, fontWeight: "bold", color: "#1a1a2e", marginBottom: 15 },
  summaryRow:          { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  summaryLabel:        { fontSize: 14, color: "#666" },
  summaryValue:        { fontSize: 14, color: "#1a1a2e", fontWeight: "500" },
  divider:             { height: 1, backgroundColor: "#e0e0e0", marginVertical: 10 },
  totalLabel:          { fontSize: 16, fontWeight: "bold", color: "#1a1a2e" },
  totalValue:          { fontSize: 16, fontWeight: "bold", color: "#4CAF50" },
  buttonContainer:     { flexDirection: "row", gap: 15, marginTop: 30 },
  resetButton:         { flex: 1, padding: 15, borderRadius: 10, borderWidth: 2, borderColor: "#e0e0e0", alignItems: "center" },
  resetButtonText:     { fontSize: 16, color: "#666" },
  bookButton:          { flex: 2, padding: 15, borderRadius: 10, backgroundColor: "#4CAF50", alignItems: "center" },
  bookButtonDisabled:  { backgroundColor: "#a5d6a7" },
  bookButtonText:      { fontSize: 16, color: "#fff", fontWeight: "bold" },
  cancelLink:          { alignItems: "center", marginTop: 20, marginBottom: 40 },
  cancelLinkText:      { fontSize: 16, color: "#666" },
});