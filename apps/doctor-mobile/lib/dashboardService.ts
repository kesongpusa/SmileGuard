/**
 * Dashboard Service - Doctor Mobile
 * Fetches dashboard data from Supabase tables
 */

import { supabase } from './supabase';
import { Appointment } from '@smileguard/shared-types';

// ─────────────────────────────────────────
// APPOINTMENTS
// ─────────────────────────────────────────

/**
 * Fetch appointments for a specific doctor
 * Maps to Supabase 'appointments' table
 */
export async function fetchDoctorAppointments(doctorId: string): Promise<{
  success: boolean;
  data: Appointment[];
  message: string;
}> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist_id,
        service,
        appointment_date,
        appointment_time,
        status,
        notes,
        created_at,
        updated_at
      `)
      .eq('dentist_id', doctorId)
      .order('appointment_date', { ascending: false });

    if (error) {
      console.error('❌ Error fetching appointments:', error);
      return { success: false, data: [], message: error.message };
    }

    // Transform to match the dashboard format
    const appointments: Appointment[] = (data || []).map((apt: any) => ({
      id: apt.id,
      patient_id: apt.patient_id,
      dentist_id: apt.dentist_id,
      service: apt.service,
      appointment_date: apt.appointment_date,
      appointment_time: apt.appointment_time,
      status: apt.status,
      notes: apt.notes,
      created_at: apt.created_at,
      updated_at: apt.updated_at,
    }));

    console.log(`✅ Fetched ${appointments.length} appointments for doctor ${doctorId}`);
    return { success: true, data: appointments, message: 'Appointments fetched successfully' };
  } catch (err) {
    console.error('❌ Exception fetching appointments:', err);
    return { success: false, data: [], message: 'Failed to fetch appointments' };
  }
}

/**
 * Fetch today's appointments for a doctor
 * Maps to Supabase 'appointments' table with DATE filter
 */
export async function fetchTodayAppointments(doctorId: string, date: string): Promise<{
  success: boolean;
  data: Appointment[];
  message: string;
}> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist_id,
        service,
        appointment_date,
        appointment_time,
        status,
        notes,
        created_at,
        updated_at
      `)
      .eq('dentist_id', doctorId)
      .eq('appointment_date', date)
      .order('appointment_time', { ascending: true });

    if (error) {
      console.error('❌ Error fetching today appointments:', error);
      return { success: false, data: [], message: error.message };
    }

    const appointments: Appointment[] = (data || []).map((apt: any) => ({
      id: apt.id,
      patient_id: apt.patient_id,
      dentist_id: apt.dentist_id,
      service: apt.service,
      appointment_date: apt.appointment_date,
      appointment_time: apt.appointment_time,
      status: apt.status,
      notes: apt.notes,
      created_at: apt.created_at,
      updated_at: apt.updated_at,
    }));

    console.log(`✅ Fetched ${appointments.length} appointments for today (${date})`);
    return { success: true, data: appointments, message: 'Today appointments fetched successfully' };
  } catch (err) {
    console.error('❌ Exception fetching today appointments:', err);
    return { success: false, data: [], message: 'Failed to fetch today appointments' };
  }
}

// ─────────────────────────────────────────
// APPOINTMENT STATS
// ─────────────────────────────────────────

/**
 * Get appointment statistics for a doctor
 * Counts appointments in each status category
 */
export async function getAppointmentStats(doctorId: string): Promise<{
  success: boolean;
  stats: {
    total: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  message: string;
}> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('status')
      .eq('dentist_id', doctorId);

    if (error) {
      console.error('❌ Error fetching stats:', error);
      return {
        success: false,
        stats: { total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0 },
        message: error.message,
      };
    }

    const appointments = data || [];
    const stats = {
      total: appointments.length,
      scheduled: appointments.filter((a: any) => a.status === 'scheduled').length,
      completed: appointments.filter((a: any) => a.status === 'completed').length,
      cancelled: appointments.filter((a: any) => a.status === 'cancelled').length,
      noShow: appointments.filter((a: any) => a.status === 'no-show').length,
    };

    console.log('✅ Stats:', stats);
    return { success: true, stats, message: 'Stats fetched successfully' };
  } catch (err) {
    console.error('❌ Exception fetching stats:', err);
    return {
      success: false,
      stats: { total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0 },
      message: 'Failed to fetch stats',
    };
  }
}

/**
 * Get total patient count
 * Counts profiles with role='patient'
 */
export async function getTotalPatientCount(): Promise<{
  success: boolean;
  count: number;
  message: string;
}> {
  try {
    const { data, error, count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .eq('role', 'patient');

    if (error) {
      console.error('❌ Error fetching patient count:', error);
      return { success: false, count: 0, message: error.message };
    }

    console.log(`✅ Patient count: ${count}`);
    return { success: true, count: count || 0, message: 'Patient count fetched' };
  } catch (err) {
    console.error('❌ Exception fetching patient count:', err);
    return { success: false, count: 0, message: 'Failed to fetch patient count' };
  }
}

// ─────────────────────────────────────────
// PATIENTS
// ─────────────────────────────────────────

/**
 * Fetch all patients associated with a doctor
 * Fetches all patients from profiles table (not limited to those with appointments)
 */
export async function fetchDoctorPatients(doctorId: string): Promise<{
  success: boolean;
  data: any[];
  message: string;
}> {
  try {
    // Fetch all patients from profiles table
    const { data: patients, error: patError } = await supabase
      .from('profiles')
      .select('id, name, email, role, service')
      .eq('role', 'patient')
      .order('name', { ascending: true });

    if (patError) {
      console.error('❌ Error fetching patients:', patError);
      return { success: false, data: [], message: patError.message };
    }

    if (!patients || patients.length === 0) {
      console.log('ℹ️ No patients found in the system');
      return { success: true, data: [], message: 'No patients found' };
    }

    console.log(`✅ Fetched ${patients.length} total patients`);
    return { success: true, data: patients, message: 'Patients fetched successfully' };
  } catch (err) {
    console.error('❌ Exception fetching patients:', err);
    return { success: false, data: [], message: 'Failed to fetch patients' };
  }
}

// ─────────────────────────────────────────
// APPOINTMENT DETAILS
// ─────────────────────────────────────────

/**
 * Fetch appointment with patient details
 * Combines appointments and profiles tables
 */
export async function fetchAppointmentWithPatientDetails(appointmentId: string): Promise<{
  success: boolean;
  data: any;
  message: string;
}> {
  try {
    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist_id,
        service,
        appointment_date,
        appointment_time,
        status,
        notes,
        created_at,
        updated_at
      `)
      .eq('id', appointmentId)
      .single();

    if (error) {
      console.error('❌ Error fetching appointment:', error);
      return { success: false, data: null, message: error.message };
    }

    // Fetch patient details
    let result: any = appointment || {};
    if (appointment?.patient_id) {
      const { data: patient } = await supabase
        .from('profiles')
        .select('id, name, email, role, service')
        .eq('id', appointment.patient_id)
        .single();

      result = { ...appointment, patientInfo: patient };
    }

    console.log('✅ Appointment with details fetched');
    return { success: true, data: result, message: 'Appointment fetched successfully' };
  } catch (err) {
    console.error('❌ Exception fetching appointment details:', err);
    return { success: false, data: null, message: 'Failed to fetch appointment' };
  }
}

// ─────────────────────────────────────────
// AVAILABILITY & SCHEDULING
// ─────────────────────────────────────────

/**
 * Check doctor's available time slots for a given date
 * Returns booked times so available slots can be calculated
 */
export async function getBookedTimeSlots(doctorId: string, date: string): Promise<{
  success: boolean;
  bookedTimes: string[];
  message: string;
}> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('appointment_time')
      .eq('dentist_id', doctorId)
      .eq('appointment_date', date)
      .in('status', ['scheduled', 'completed']);

    if (error) {
      console.error('❌ Error fetching booked times:', error);
      return { success: false, bookedTimes: [], message: error.message };
    }

    const bookedTimes = (data || []).map((a: any) => a.appointment_time);
    console.log(`✅ Found ${bookedTimes.length} booked slots for ${date}`);
    return { success: true, bookedTimes, message: 'Booked times fetched' };
  } catch (err) {
    console.error('❌ Exception fetching booked times:', err);
    return { success: false, bookedTimes: [], message: 'Failed to fetch booked times' };
  }
}
