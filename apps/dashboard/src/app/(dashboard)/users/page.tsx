'use client';

import { DashboardUser } from '@/types';
import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import api from '@/utils/client/api-client';
import { Shield, UserPlus, Mail, Loader2, Calendar, Link2, UserCheck, UserX, Eye, EyeOff } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/utils/enums';
import { IdDocumentField } from '@/components/ui/IdDocumentField';
import { UsersTableDesktop } from '@/components/UsersTableDesktop';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';

function UsersPageContent() {
  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get('targetOrgId');
  const { role: actorRole } = useAuth();

  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states (DashboardUser creation)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Link Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DashboardUser | null>(null);
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = targetOrgId ? `/users?targetOrgId=${targetOrgId}` : '/users';
      const { data } = await api.get(url);
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar la lista de usuarios');
    } finally {
      setIsLoading(false);
    }
  }, [targetOrgId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Focus trapping for Link Driver Modal
  useEffect(() => {
    if (!isLinkModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLinkModalOpen(false);
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
        );
        if (focusableElements.length === 0) return;
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Focus the first input on open
    const timer = setTimeout(() => {
      const firstInput = modalRef.current?.querySelector('input');
      if (firstInput) firstInput.focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isLinkModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload: { name: string; email: string; password: string; orgId?: string } = {
        name,
        email,
        password,
      };

      if (targetOrgId) {
        payload.orgId = targetOrgId;
      }

      await api.post('/users', payload);

      setName('');
      setEmail('');
      setPassword('');
      setIsModalOpen(false);

      fetchUsers();
    } catch (err) {
      console.error(err);
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'Error al crear el administrador');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setIsLinking(true);

    try {
      await api.post('/drivers/claim', {
        userId: selectedUser?.id,
        nationalId,
        phone: phone || undefined,
      });

      setNationalId('');
      setPhone('');
      setSelectedUser(null);
      setIsLinkModalOpen(false);

      fetchUsers();
    } catch (err: any) {
      console.error(err);
      const message = err.response?.data?.message;
      setLinkError(message || 'Error al vincular el conductor.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (userId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas desvincular a este conductor?')) {
      return;
    }

    try {
      await api.post('/drivers/unclaim', { userId });
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      const message = err.response?.data?.message;
      setError(message || 'Error al desvincular el conductor.');
    }
  };

  const showGrouping = users.length > 5;
  const ownerUsers = users.filter(u => u.role === ROLES.OWNER);
  const adminUsers = users.filter(u => u.role === ROLES.ADMIN);

  const groups = [
    { id: 'owner', name: 'Propietarios (Owner)', badge: 'bg-primary', usersList: ownerUsers },
    { id: 'admin', name: 'Administradores (Admin)', badge: 'bg-secondary', usersList: adminUsers },
  ];

  const firstNonEmptyGroup = groups.find(g => g.usersList.length > 0)?.id || 'owner';

  const renderUserCard = (u: DashboardUser) => {
    const hasDriverLink = !!u.driver;
    const canManage = (actorRole === ROLES.SUPER_ADMIN && u.role !== ROLES.SUPER_ADMIN) ||
                      (actorRole === ROLES.OWNER && u.role === ROLES.ADMIN);

    return (
      <div
        key={u.id}
        className="card bg-base-100/60 backdrop-blur-sm border border-base-200 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col justify-between text-left"
      >
        <div className="card-body p-6 flex flex-col justify-between h-full">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Shield className="text-primary size-6" />
              </div>
              <Badge variant={u.role === 'OWNER' ? 'primary' : 'secondary'} size="sm">
                {u.role === 'OWNER' ? 'Propietario (Owner)' : 'Administrador (Admin)'}
              </Badge>
            </div>

            <div>
              <h2 className="card-title text-lg font-bold text-base-content leading-none">
                {u.name}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-base-content/60 mt-1">
                <Mail className="size-3.5" />
                {u.email}
              </div>
            </div>

            <div className="divider my-1 opacity-50"></div>

            {/* Driver status badge */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-base-content/50 font-medium">Vinculación de Conductor:</span>
              {hasDriverLink ? (
                <Badge variant="success" size="sm" className="flex items-center gap-1">
                  <UserCheck className="size-3" />
                  Vínculo Activo
                </Badge>
              ) : (
                <Badge variant="ghost" size="sm" className="flex items-center gap-1">
                  <UserX className="size-3" />
                  No Vinculado
                </Badge>
              )}
            </div>

            {hasDriverLink && u.driver && (
              <div className="text-xs text-base-content/70 space-y-1 bg-base-200/40 p-2.5 rounded-lg border border-base-300/30">
                <div>
                  <strong>Cédula:</strong> <span className="font-mono">{u.driver.nationalId}</span>
                </div>
                {u.driver.phone && (
                  <div>
                    <strong>Teléfono:</strong> <span className="font-mono">{u.driver.phone}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3 mt-4">
            <div className="divider my-1 opacity-30"></div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-base-content/40 font-medium">
                <Calendar className="size-3.5" />
                {new Date(u.createdAt).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </div>

              {canManage && (
                <div className="card-actions">
                  {hasDriverLink ? (
                    <Button
                      variant="error"
                      size="xs"
                      className="btn-outline"
                      onClick={() => handleUnlink(u.id)}
                      title="Desvincular Conductor"
                    >
                      Desvincular
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={() => {
                        setSelectedUser(u);
                        setNationalId('');
                        setPhone('');
                        setLinkError(null);
                        setIsLinkModalOpen(true);
                      }}
                      title="Vincular Conductor"
                    >
                      Vincular
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <BackButton
          fallbackHref={targetOrgId ? `/admin?targetOrgId=${targetOrgId}` : "/admin"}
        >
          Volver a administración
        </BackButton>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Shield className="text-primary size-7" />
            Administración del Equipo
          </h1>
          <p className="text-base-content/60 text-sm">
            Administra los usuarios con acceso de gestión (Admins) para coordinar las operaciones de tu flota.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          leftIcon={<UserPlus className="size-5" />}
        >
          Nuevo Administrador
        </Button>
      </div>

      {error && !isModalOpen && (
        <Alert variant="error" message={error} />
      )}

      {/* Main Grid/List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-base-content/60 text-sm">Cargando usuarios...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-base-100/30 rounded-2xl border border-dashed border-base-300 py-20">
          <Shield className="size-16 text-base-content/20 mb-4" />
          <h3 className="text-lg font-bold">No hay administradores registrados</h3>
          <p className="text-base-content/50 text-sm max-w-sm mt-1">
            Agrega usuarios adicionales para que puedan ver mapas, registrar vehículos y asignar conductores.
          </p>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="mt-6"
          >
            Registrar Primer Administrador
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="hidden lg:block">
            <UsersTableDesktop
              users={users}
              actorRole={actorRole}
              onLink={(u) => {
                setSelectedUser(u);
                setNationalId('');
                setPhone('');
                setLinkError(null);
                setIsLinkModalOpen(true);
              }}
              onUnlink={handleUnlink}
            />
          </div>

          {/* Mobile View */}
          <div className="block lg:hidden">
            {showGrouping ? (
              <div className="space-y-4">
                {groups.map((group) => {
                  if (group.usersList.length === 0) return null;
                  return (
                    <div
                      key={group.id}
                      className="collapse collapse-arrow bg-base-100/40 border border-base-200 shadow-md rounded-2xl overflow-hidden backdrop-blur-md"
                    >
                      <input
                        type="checkbox"
                        defaultChecked={group.id === firstNonEmptyGroup}
                        className="peer"
                        aria-label={`Mostrar usuarios ${group.name}`}
                      />
                      <div className="collapse-title text-sm font-bold flex items-center gap-2.5 pr-10 text-base-content bg-base-200/20">
                        <span className={`size-2.5 rounded-full ${group.badge}`} />
                        <span>{group.name}</span>
                        <span className="badge badge-neutral badge-sm ml-2 font-mono font-bold bg-base-300 border-none text-base-content/85">
                          {group.usersList.length}
                        </span>
                      </div>
                      <div className="collapse-content p-4 bg-base-100/10 space-y-4">
                        {group.usersList.map(renderUserCard)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {users.map(renderUserCard)}
              </div>
            )}
          </div>
        </>
      )}

      {/* DashboardUser Creation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <UserPlus className="text-primary size-6" />
            Nuevo Administrador
          </span>
        }
        subtitle="El usuario creado tendrá permisos para gestionar vehículos, conductores y telemetría de esta organización."
      >
        {error && (
          <Alert variant="error" message={error} className="mb-4" />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            label="Nombre Completo"
            placeholder="Ej. Juan Pérez"
            disabled={isSubmitting}
          />

          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            label="Correo Electrónico"
            placeholder="juan.perez@correo.com"
            disabled={isSubmitting}
          />

          <Input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            label="Contraseña Inicial (Mínimo 6 caracteres)"
            placeholder="Escribe la contraseña temporal"
            minLength={6}
            disabled={isSubmitting}
            className="pr-10"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="flex items-center text-base-content/40 hover:text-base-content/70 cursor-pointer"
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />

          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
            >
              Registrar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Link Driver Modal */}
      <Modal
        isOpen={isLinkModalOpen && !!selectedUser}
        onClose={() => !isLinking && setIsLinkModalOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Link2 className="text-primary size-6" />
            Vincular Conductor
          </span>
        }
        subtitle={
          selectedUser ? (
            <span>
              Vincula al usuario <strong>{selectedUser.name}</strong> con su número de documento de identidad para establecer su perfil de conductor.
            </span>
          ) : undefined
        }
      >
        {linkError && (
          <Alert variant="error" message={linkError} className="mb-4" />
        )}

        <form onSubmit={handleLinkSubmit} className="space-y-4">
          <IdDocumentField
            value={nationalId}
            onChange={setNationalId}
            label="Número de Documento de Identidad"
            disabled={isLinking}
            required
          />

          <Input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            label="Teléfono (Opcional)"
            placeholder="Ej. +593987654321"
            disabled={isLinking}
          />

          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="ghost"
              onClick={() => setIsLinkModalOpen(false)}
              disabled={isLinking}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isLinking}
            >
              Vincular
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-base-content/60 text-sm">Cargando usuarios...</p>
      </div>
    }>
      <UsersPageContent />
    </Suspense>
  );
}
