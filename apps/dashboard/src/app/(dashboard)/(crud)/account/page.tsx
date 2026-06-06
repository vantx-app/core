'use client';

import { DriverDocumentsStats, DriverProfileStats, UserProfile } from '@/types';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import api from '@/utils/client/api-client';
import {
  Mail,
  Shield,
  Building2,
  Key,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { DriverProfileCard } from '@/components/account/DriverProfileCard';
import { DriverDocumentsCard } from '@/components/account/DriverDocumentsCard';

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [driverStats, setDriverStats] = useState<(DriverProfileStats & DriverDocumentsStats) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password change states
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/users/me');
      setProfile(data);

      // Fetch driver stats if user has DRIVER role or has a linked driver profile
      if (data.role === 'DRIVER' || data.driver) {
        try {
          const statsRes = await api.get('/drivers/me/stats');
          setDriverStats(statsRes.data);
        } catch (err) {
          console.error('Error fetching driver stats on account page:', err);
        }
      }
    } catch (err) {
      console.error('Error al cargar perfil:', err);
      setError('No se pudo cargar el perfil del usuario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        router.push('/login');
        router.refresh();
      } else {
        alert('Error al cerrar sesión');
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPass !== confirmPass) {
      setPasswordError('Las contraseñas nuevas no coinciden.');
      return;
    }

    if (newPass.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setChangingPassword(true);

    try {
      await api.post('/users/change-password', {
        oldPass,
        newPass,
      });
      setPasswordSuccess(true);
      setOldPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err) {
      console.error('Error changing password:', err);
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setPasswordError(message || 'Error al cambiar la contraseña. Verifica tu contraseña actual.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-sm text-base-content/60">Cargando perfil de cuenta...</p>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="avatar placeholder">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl w-16 h-16 font-extrabold text-xl shadow-md shadow-blue-500/20">
              <span>{profile ? getInitials(profile.name) : 'U'}</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-base-content">
              {profile?.name}
            </h1>
            <p className="text-xs text-base-content/60 flex items-center gap-1.5 mt-1 font-mono">
              <Mail className="size-3.5" /> {profile?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn btn-outline btn-error gap-2 rounded-xl active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <LogOut className="size-4" />
          Cerrar Sesión
        </button>
      </div>

      {error && (
        <div className="alert alert-error shadow-lg">
          <AlertCircle className="size-5 text-white" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile details */}
        <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 shadow-md rounded-2xl md:col-span-1">
          <div className="card-body p-6 space-y-4">
            <h3 className="font-bold text-sm text-base-content/40 uppercase tracking-wider">Detalles de la cuenta</h3>

            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] text-base-content/50 uppercase block font-semibold">Rol del Sistema</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Shield className="size-4 text-primary shrink-0" />
                  <span className="badge badge-primary font-bold text-xs uppercase tracking-wide py-2">
                    {profile?.role}
                  </span>
                </div>
              </div>

              {profile?.organization && (
                <div>
                  <span className="text-[10px] text-base-content/50 uppercase block font-semibold">Organización / Empresa</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Building2 className="size-4 text-base-content/60 shrink-0" />
                    <span className="font-medium text-sm text-base-content/95">
                      {profile.organization.name}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Change password form */}
        <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 shadow-md rounded-2xl md:col-span-2">
          <div className="card-body p-6">
            <h2 className="card-title text-lg font-bold flex items-center gap-2 mb-4 text-base-content">
              <Key className="text-primary size-5" />
              Seguridad & Contraseña
            </h2>

            {passwordSuccess && (
              <div className="alert alert-success shadow p-3 text-xs flex items-center gap-2 mb-4">
                <CheckCircle2 className="size-4 shrink-0 text-white" />
                <span className="text-white">¡Contraseña actualizada con éxito!</span>
              </div>
            )}

            {passwordError && (
              <div className="alert alert-error shadow p-3 text-xs flex items-center gap-2 mb-4">
                <AlertCircle className="size-4 shrink-0 text-white" />
                <span className="text-white">{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text font-bold text-xs text-base-content/85">Contraseña Actual</span>
                </label>
                <input
                  type="password"
                  required
                  value={oldPass}
                  onChange={(e) => setOldPass(e.target.value)}
                  placeholder="Introduce tu contraseña actual"
                  className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 font-mono text-sm"
                  disabled={changingPassword}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-bold text-xs text-base-content/85">Nueva Contraseña</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 font-mono text-sm"
                    disabled={changingPassword}
                  />
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-bold text-xs text-base-content/85">Confirmar Nueva Contraseña</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 font-mono text-sm"
                    disabled={changingPassword}
                  />
                </div>
              </div>

              <div className="card-actions justify-end mt-6">
                <button
                  type="submit"
                  className="btn btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white shadow-md hover:brightness-110 active:scale-95 transition-all duration-200 gap-2 cursor-pointer"
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    'Actualizar Contraseña'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Driver profile details if user is a driver or has driver profile linked */}
      {driverStats && (
        <>
          <DriverProfileCard stats={driverStats} />
          <DriverDocumentsCard driverStats={driverStats} onSync={fetchProfile} />
        </>
      )}
    </div>
  );
}