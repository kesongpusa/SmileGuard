import { supabase } from './supabase';
export async function cancelAppointment(
  appointmentId: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`🚫 Cancelling appointment: ${appointmentId}`);
    
    // Use RPC function to bypass RLS (same as update_appointment_status)
    const { data, error } = await supabase.rpc('update_appointment_status', {
      p_appointment_id: appointmentId,
      p_new_status: 'cancelled'
    });

    if (error) {
      console.error('❌ Cancellation error via RPC:', error);
      return { success: false, message: 'Cancellation failed. Please try again.' };
    }

    console.log('✅ Appointment cancelled successfully via RPC');
    return { success: true, message: 'Appointment cancelled successfully.' };
  } catch (err) {
    console.error('❌ Exception during cancellation:', err);
    return { success: false, message: 'Cancellation failed. Please try again.' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCTOR DASHBOARD SPECIFIC TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DoctorAppointment {
  id: string;
  patient_id: string;
  dentist_id: string | null;
  service: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  created_at?: string;
  updated_at?: string;
  patient_name?: string; // Patient name from profiles table
  patient_avatar?: string; // Patient avatar URL from profiles table
}

// ─────────────────────────────────────────
// DIAGNOSTIC: Test if RLS is filtering appointments
// ─────────────────────────────────────────
export async function testDirectQuery(date: string): Promise<void> {
  try {
    console.log('🧪 TEST 1: Direct select without any filters');
    const { data: all, error: allError } = await supabase
      .from('appointments')
      .select('id, status, appointment_date, appointment_time')
      .limit(5);
    
    if (allError) {
      console.error('❌ Error with direct select:', allError);
    } else {
      console.log(`✅ Direct select returned ${all?.length || 0} appointments:`, all);
      all?.forEach((apt: any) => {
        console.log(`  - id=${apt.id}, status=${apt.status}`);
      });
    }

    console.log(`\n🧪 TEST 2: Select for specific date: ${date}`);
    const { data: byDate, error: dateError } = await supabase
      .from('appointments')
      .select('id, status, appointment_date, appointment_time')
      .eq('appointment_date', date);
    
    if (dateError) {
      console.error('❌ Error with date select:', dateError);
    } else {
      console.log(`✅ Date select returned ${byDate?.length || 0} appointments:`, byDate);
      byDate?.forEach((apt: any) => {
        console.log(`  - id=${apt.id}, status=${apt.status}`);
      });
    }

    console.log('\n🧪 TEST 3: Select only cancelled appointments');
    const { data: cancelled, error: cancelledError } = await supabase
      .from('appointments')
      .select('id, status, appointment_date, appointment_time')
      .eq('status', 'cancelled')
      .limit(10);
    
    if (cancelledError) {
      console.error('❌ Error getting cancelled:', cancelledError);
    } else {
      console.log(`✅ Found ${cancelled?.length || 0} cancelled appointments:`, cancelled);
    }
  } catch (err: any) {
    console.error('❌ Exception in test:', err?.message);
  }
}

// ─────────────────────────────────────────
export async function getDoctorAppointments(
  dentistId: string | null,
  startDate?: string,
  endDate?: string
): Promise<DoctorAppointment[]> {
  try {
    console.log('🔍 getDoctorAppointments called with:', { dentistId, startDate, endDate });
    
    // IMPORTANT: Use RPC function to bypass RLS policy that filters out cancelled appointments
    const { data: appointmentsData, error: rpcError } = await supabase.rpc('get_appointments_range', {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_dentist_id: dentistId || null
    });

    console.log('✅ RPC executed. Response:', {
      dataLength: appointmentsData?.length,
      error: rpcError
    });

    if (rpcError) {
      console.error('❌ RPC Error fetching doctor appointments:', {
        code: rpcError.code,
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
      });
      // Fallback: Try direct query anyway
      console.log('⚠️ Attempting fallback direct query...');
      return fallbackGetDoctorAppointments(dentistId, startDate, endDate);
    }

    if (!appointmentsData) {
      console.log('ℹ️ appointmentsData is null');
      return [];
    }

    // Log all statuses of returned appointments
    console.log('📋 Raw appointments from database:');
    appointmentsData.forEach((apt: any, idx: number) => {
      console.log(`  [${idx}] id=${apt.id}, status=${apt.status}, date=${apt.appointment_date}, time=${apt.appointment_time}`);
    });

    if (appointmentsData.length === 0) {
      console.log('ℹ️ No appointments found');
      return [];
    }

    console.log(`📋 Found ${appointmentsData.length} appointments. Fetching patient profiles...`);

    // Step 2: Get unique patient IDs
    const patientIds = [...new Set((appointmentsData as any[]).map((apt: any) => apt.patient_id))];
    console.log(`📋 Found ${patientIds.length} unique patients`);

    // Step 3: Fetch profiles for all patients
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', patientIds);

    console.log('📊 Profiles Query Response:', {
      profilesDataLength: profilesData?.length || 0,
      profilesError,
    });

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
    }

    // Step 4: Create a map of patient ID -> profile
    const profileMap = new Map();
    (profilesData || []).forEach(profile => {
      profileMap.set(profile.id, profile);
      const nameValue = profile.full_name || profile.name || profile.user_name;
      console.log(`✅ Profile found: ${profile.id} -> ${nameValue}`);
    });

    // Step 5: Transform appointments with patient names and avatars
    const transformedData = appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      const patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
      const patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;

      return {
        ...apt,
        patient_name: patientName,
        patient_avatar: patientAvatar,
      };
    });

    console.log(`✅ Fetched ${transformedData.length} appointments for doctor`);
    return transformedData || [];
  } catch (err: any) {
    console.error('❌ Exception fetching doctor appointments:', {
      message: err?.message,
      stack: err?.stack,
      fullError: err
    });
    return [];
  }
}

// ─────────────────────────────────────────
// FALLBACK: Direct query if RPC fails
// ─────────────────────────────────────────
async function fallbackGetDoctorAppointments(
  dentistId: string | null,
  startDate?: string,
  endDate?: string
): Promise<DoctorAppointment[]> {
  try {
    console.log('⚠️ Fallback: Using direct query for doctor appointments');
    
    let query = supabase
      .from('appointments')
      .select('*');

    if (dentistId && dentistId !== 'null') {
      query = query.eq('dentist_id', dentistId);
    } else {
      // If no dentistId provided, return empty (don't show null appointments)
      return [];
    }

    if (startDate) {
      query = query.gte('appointment_date', startDate);
    }
    if (endDate) {
      query = query.lte('appointment_date', endDate);
    }

    const { data: appointmentsData, error: appointmentsError } = await query
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    if (appointmentsError) {
      console.error('❌ Fallback query error:', appointmentsError);
      return [];
    }

    if (!appointmentsData || appointmentsData.length === 0) {
      console.log('ℹ️ Fallback query returned no results');
      return [];
    }

    // Get unique patient IDs and fetch profiles
    const patientIds = [...new Set(appointmentsData.map(apt => apt.patient_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', patientIds);

    const profileMap = new Map();
    (profilesData || []).forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    // Transform and return
    return appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      const patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
      const patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;

      return {
        ...apt,
        patient_name: patientName,
        patient_avatar: patientAvatar,
      };
    });
  } catch (err: any) {
    console.error('❌ Fallback exception:', err);
    return [];
  }
}

// ─────────────────────────────────────────
// GET APPOINTMENTS FOR A SPECIFIC DATE
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// GET APPOINTMENTS FOR A SPECIFIC DATE
// ─────────────────────────────────────────
export async function getDoctorAppointmentsByDate(
  dentistId: string | null,
  date: string
): Promise<DoctorAppointment[]> {
  try {
    console.log('🔍 getDoctorAppointmentsByDate called with:', { dentistId, date });
    
    // IMPORTANT: Use RPC function to bypass RLS policy that filters out cancelled appointments
    const { data: appointmentsData, error: rpcError } = await supabase.rpc('get_appointments_by_date', {
      p_date: date,
      p_dentist_id: dentistId || null
    });

    console.log('✅ RPC executed. Response:', {
      dataLength: appointmentsData?.length,
      error: rpcError
    });

    if (rpcError) {
      console.error('❌ RPC Error fetching appointments by date:', {
        code: rpcError.code,
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
      });
      // Fallback: Try direct query anyway
      console.log('⚠️ Attempting fallback direct query...');
      return fallbackGetAppointmentsByDate(dentistId, date);
    }

    if (!appointmentsData) {
      console.log('ℹ️ appointmentsData is null');
      return [];
    }

    // Log all statuses of returned appointments
    console.log('📋 Raw appointments from database:');
    appointmentsData.forEach((apt: any, idx: number) => {
      console.log(`  [${idx}] id=${apt.id}, status=${apt.status}, date=${apt.appointment_date}, time=${apt.appointment_time}`);
    });

    if (appointmentsData.length === 0) {
      console.log('ℹ️ No appointments found for date:', date);
      return [];
    }

    console.log(`📋 Found ${appointmentsData.length} appointments for ${date}. Fetching patient profiles...`);

    // Step 2: Get unique patient IDs
    const patientIds = [...new Set(appointmentsData.map((apt: any) => apt.patient_id))];
    console.log(`📋 Found ${patientIds.length} unique patients:`, patientIds);

    // Step 3: Fetch profiles for all patients
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', patientIds);

    console.log('📊 Profiles Query Response:', {
      patientIds,
      profilesDataLength: profilesData?.length || 0,
      profilesError,
    });

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
    }

    // Step 4: Create a map of patient ID -> profile
    const profileMap = new Map();
    (profilesData || []).forEach(profile => {
      profileMap.set(profile.id, profile);
      const nameValue = profile.full_name || profile.name || profile.user_name || profile.email;
      console.log(`✅ Profile found: ${profile.id} -> ${nameValue}`);
    });

    // Step 5: Transform appointments with patient names and avatars
    const transformedData = appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      const patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
      const patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;

      return {
        ...apt,
        patient_name: patientName,
        patient_avatar: patientAvatar,
      };
    });

    console.log(`✅ Fetched ${transformedData.length} appointments for date ${date}`);
    return transformedData || [];
  } catch (err: any) {
    console.error('❌ Exception fetching appointments by date:', {
      message: err?.message,
      stack: err?.stack,
      fullError: err
    });
    return fallbackGetAppointmentsByDate(dentistId, date);
  }
}

// ─────────────────────────────────────────
// FALLBACK: Direct query (if RPC fails)
// ─────────────────────────────────────────
async function fallbackGetAppointmentsByDate(
  dentistId: string | null,
  date: string
): Promise<DoctorAppointment[]> {
  try {
    console.log('🔄 Using fallback direct query...');
    
    let query = supabase
      .from('appointments')
      .select('*')
      .eq('appointment_date', date);

    const { data: appointmentsData, error } = await query
      .order('appointment_time', { ascending: true });

    if (error) {
      console.error('❌ Error in fallback query:', error);
      return [];
    }

    if (!appointmentsData || appointmentsData.length === 0) {
      return [];
    }

    // Fetch profiles
    const patientIds = [...new Set(appointmentsData.map((apt: any) => apt.patient_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', patientIds);

    const profileMap = new Map();
    (profilesData || []).forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    return appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      return {
        ...apt,
        patient_name: profile?.full_name || profile?.name || profile?.user_name || apt.patient_id,
        patient_avatar: profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null,
      };
    });
  } catch (err: any) {
    console.error('❌ Fallback query also failed:', err?.message);
    return [];
  }
}

// ─────────────────────────────────────────
// DIAGNOSTIC: Check appointments table schema
// ─────────────────────────────────────────
export async function checkAppointmentsTableSchema(): Promise<void> {
  try {
    console.log('🔍 Checking appointments table schema...');
    
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error accessing appointments table:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Appointments table exists. First row columns:', Object.keys(data[0]));
      console.log('📊 Sample appointment:', data[0]);
    } else {
      console.log('ℹ️ Appointments table is empty');
    }
  } catch (err: any) {
    console.error('❌ Exception checking schema:', {
      message: err?.message,
      stack: err?.stack,
    });
  }
}

// ─────────────────────────────────────────
// UPDATE APPOINTMENT STATUS (for doctor dashboard)
// ─────────────────────────────────────────
export async function updateDoctorAppointmentStatus(
  appointmentId: string,
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show',
  doctorId: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`🔄 Updating appointment ${appointmentId}`);
    console.log(`📋 Doctor: ${doctorId}, New Status: ${status}`);
    
    // Update appointment with doctor assignment and status
    const { data, error } = await supabase
      .from('appointments')
      .update({ 
        status, 
        dentist_id: doctorId,
        updated_at: new Date().toISOString() 
      })
      .eq('id', appointmentId)
      .select();

    console.log('📊 Update response:', { rowsAffected: data?.length, error });

    if (error) {
      console.error('❌ Supabase error:', error.message);
      return { success: false, message: `Failed to update: ${error.message}` };
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ No rows updated');
      return { success: false, message: 'Update failed: No rows affected' };
    }

    console.log('✅ Update successful');
    return { success: true, message: 'Appointment status updated successfully' };
  } catch (err) {
    console.error('❌ Exception:', err);
    return { success: false, message: `Exception: ${err}` };
  }
}