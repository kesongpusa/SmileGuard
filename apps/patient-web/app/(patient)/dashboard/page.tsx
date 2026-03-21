'use client';

import Link from 'next/link';

export default function PatientDashboard() {
  // TODO: Fetch real data from Supabase
  const upcomingAppointments = 1;
  const pendingTreatments = 2;
  const outstandingBalance = 2500;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Dashboard</h1>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Upcoming Appointments</p>
              <p className="text-3xl font-bold text-blue-600">{upcomingAppointments}</p>
            </div>
            <div className="text-4xl text-blue-200">📅</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Pending Treatments</p>
              <p className="text-3xl font-bold text-green-600">{pendingTreatments}</p>
            </div>
            <div className="text-4xl text-green-200">🦷</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Outstanding Balance</p>
              <p className="text-3xl font-bold text-red-600">₱{outstandingBalance.toFixed(2)}</p>
            </div>
            <div className="text-4xl text-red-200">💳</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/appointments/book">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer">
            <div className="text-3xl mb-2">📍</div>
            <h3 className="font-semibold text-gray-800">Book Appointment</h3>
            <p className="text-sm text-gray-500">Schedule a dental visit</p>
          </div>
        </Link>

        <Link href="/analysis">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer">
            <div className="text-3xl mb-2">🔬</div>
            <h3 className="font-semibold text-gray-800">AI Analysis</h3>
            <p className="text-sm text-gray-500">Upload oral images</p>
          </div>
        </Link>

        <Link href="/billing/pay">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer">
            <div className="text-3xl mb-2">💰</div>
            <h3 className="font-semibold text-gray-800">Make Payment</h3>
            <p className="text-sm text-gray-500">Pay outstanding bills</p>
          </div>
        </Link>

        <Link href="/documents">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer">
            <div className="text-3xl mb-2">📄</div>
            <h3 className="font-semibold text-gray-800">My Documents</h3>
            <p className="text-sm text-gray-500">X-rays & records</p>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Recent Activity</h2>
        <p className="text-gray-500">No recent activity yet</p>
      </div>
    </div>
  );
}
