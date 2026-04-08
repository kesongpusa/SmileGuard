import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPatientAppointments } from "../../lib/profilesPatients";
import { getStatusColor, getStatusBgColor } from "../../lib/statusHelpers";
import { formatDateWithTime } from "../../lib/dateFormatters";

interface AppointmentHistoryProps {
  patientId: string;
  patientName: string;
  onBack: () => void;
}

const categorizeAppointments = (appointments: any[]) => {
  const now = new Date();
  const past: any[] = [];
  const current: any[] = [];
  const future: any[] = [];

  appointments.forEach((appt) => {
    const apptDate = new Date(appt.appointment_date);
    const diffMs = apptDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= 0 && diffDays < 1) {
      current.push(appt);
    } else if (diffDays >= 1) {
      future.push(appt);
    } else {
      past.push(appt);
    }
  });

  return { past, current, future };
};

function AppointmentCard({ appointment }: { appointment: any }) {
  const apptDate = new Date(appointment.appointment_date);
  const formattedDate = apptDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusColor = getStatusColor(appointment.status);
  const statusBgColor = getStatusBgColor(appointment.status);

  return (
    <View style={styles.appointmentCard}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardService}>{appointment.service || 'General Appointment'}</Text>
          <Text style={styles.cardDate}>{formattedDate}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusBgColor },
          ]}
        >
          <Text style={[styles.statusText, { color: statusColor }]}>
            {appointment.status?.charAt(0).toUpperCase() + appointment.status?.slice(1) || 'Scheduled'}
          </Text>
        </View>
      </View>
      {appointment.notes && (
        <View style={styles.cardBody}>
          <Text style={styles.cardNotes}>{appointment.notes}</Text>
        </View>
      )}
    </View>
  );
}

export default function AppointmentHistory({
  patientId,
  patientName,
  onBack,
}: AppointmentHistoryProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'current' | 'future' | 'past'>('all');

  useEffect(() => {
    loadAppointments();
  }, [patientId]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const appts = await getPatientAppointments(patientId);
      setAppointments(appts);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const { past, current, future } = categorizeAppointments(appointments);

  const getFilteredAppointments = () => {
    switch (activeTab) {
      case 'current':
        return current;
      case 'future':
        return future;
      case 'past':
        return past;
      case 'all':
      default:
        return appointments;
    }
  };

  const filteredAppointments = getFilteredAppointments();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Appointment History</Text>
          <Text style={styles.headerSubtitle}>{patientName}</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All ({appointments.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'current' && styles.activeTab]}
          onPress={() => setActiveTab('current')}
        >
          <Text style={[styles.tabText, activeTab === 'current' && styles.activeTabText]}>
            Today ({current.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'future' && styles.activeTab]}
          onPress={() => setActiveTab('future')}
        >
          <Text style={[styles.tabText, activeTab === 'future' && styles.activeTabText]}>
            Future ({future.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Past ({past.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0b7fab" />
            <Text style={styles.loadingText}>Loading appointments...</Text>
          </View>
        ) : filteredAppointments.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'all'
                ? 'No appointments found'
                : `No ${activeTab} appointments`}
            </Text>
          </View>
        ) : (
          <>
            {activeTab === 'all' && current.length > 0 && (
              <>
                <Text style={styles.categoryTitle}>📅 Today's Appointments</Text>
                {current.map((appt: any) => (
                  <AppointmentCard key={appt.id} appointment={appt} />
                ))}
              </>
            )}

            {activeTab === 'all' && future.length > 0 && (
              <>
                <Text style={styles.categoryTitle}>🗓️ Upcoming Appointments</Text>
                {future.map((appt: any) => (
                  <AppointmentCard key={appt.id} appointment={appt} />
                ))}
              </>
            )}

            {activeTab === 'all' && past.length > 0 && (
              <>
                <Text style={styles.categoryTitle}>📋 Past Appointments</Text>
                {past.map((appt: any) => (
                  <AppointmentCard key={appt.id} appointment={appt} />
                ))}
              </>
            )}

            {activeTab !== 'all' && filteredAppointments.length > 0 && (
              <>
                {filteredAppointments.map((appt: any) => (
                  <AppointmentCard key={appt.id} appointment={appt} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    fontSize: 16,
    color: '#0b7fab',
    fontWeight: '600',
    width: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0b7fab',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#0b7fab',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#0b7fab',
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0b7fab',
    marginTop: 16,
    marginBottom: 12,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardService: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0b7fab',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    marginTop: 8,
    paddingTop: 8,
    borderTopColor: '#f0f0f0',
    borderTopWidth: 1,
  },
  cardNotes: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
});
