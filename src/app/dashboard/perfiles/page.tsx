'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import DataTable, { Column } from '@/components/DataTable';
import { toast } from 'react-hot-toast';
import { Plus, UserPlus, Loader2, Pencil, Trash2, KeyRound, AlertCircle, X } from 'lucide-react';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import SearchableSelect from '@/components/SearchableSelect';
import { logActivity } from '@/lib/logActivity';
import { useGlobalLoading } from '@/lib/globalLoading';

interface Profile {
    user_id: string;
    nombre: string;
    email: string;
    rol: 'admin' | 'empleado' | 'gestor';
    activo: boolean;
    created_at: string;
}

export default function PerfilesPage() {
    const { withLoading } = useGlobalLoading();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    const [processing, setProcessing] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

    // Create User Form State
    const [createFormData, setCreateFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        nombre: '',
        apellido: '',
        telefono: '',
        rol: 'gestor' as 'admin' | 'empleado' | 'gestor',
    });

    // Edit User Form State
    const [editFormData, setEditFormData] = useState({
        email: '',
        nombre: '',
        apellido: '',
        telefono: '',
        rol: 'gestor' as 'admin' | 'empleado' | 'gestor',
    });

    // Password Reset Form State
    const [passwordFormData, setPasswordFormData] = useState({
        password: '',
        confirmPassword: ''
    });

    // Form Validation Errors
    const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});
    const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
    const [deleteEmail, setDeleteEmail] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin/list-profiles', {
                headers: session?.access_token
                    ? { Authorization: `Bearer ${session.access_token}` }
                    : {},
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error('Error al cargar perfiles');
                console.error(json.error);
            } else {
                setProfiles(json.profiles || []);
            }
        } catch (e) {
            toast.error('Error al cargar perfiles');
            console.error(e);
        }
        setLoading(false);
    };

    const handleOpenCreate = () => {
        setCreateFormData({
            email: '',
            password: '',
            confirmPassword: '',
            nombre: '',
            apellido: '',
            telefono: '',
            rol: 'gestor',
        });
        setCreateErrors({});
        setShowCreateModal(true);
    };

    const handleOpenEdit = (profile: Profile) => {
        setSelectedProfile(profile);
        setEditFormData({
            email: profile.email,
            nombre: profile.nombre || '',
            apellido: profile.apellido || '',
            telefono: profile.telefono || '',
            rol: profile.rol,
        });
        setEditErrors({});
        setShowEditModal(true);
    };

    const handleOpenPasswordReset = (profile: Profile) => {
        setSelectedProfile(profile);
        setPasswordFormData({
            password: '',
            confirmPassword: ''
        });
        setPasswordErrors({});
        setShowPasswordModal(true);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors: Record<string, string> = {};
        if (!createFormData.nombre?.trim()) errors.nombre = 'El nombre es obligatorio';
        if (!createFormData.email?.trim()) errors.email = 'El email es obligatorio';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createFormData.email)) errors.email = 'El formato del email no es válido';
        if (!createFormData.password) errors.password = 'La contraseña es obligatoria';
        else if (createFormData.password.length < 6) errors.password = 'La contraseña debe tener al menos 6 caracteres';
        if (createFormData.password !== createFormData.confirmPassword) errors.confirmPassword = 'Las contraseñas no coinciden';
        if (createFormData.telefono && !/^\d{9}$/.test(createFormData.telefono)) errors.telefono = 'El teléfono debe tener exactamente 9 dígitos';
        if (Object.keys(errors).length > 0) { setCreateErrors(errors); return; }
        setCreateErrors({});

        await withLoading(async () => {
            setProcessing(true);
            try {
                const session = (await supabase.auth.getSession()).data.session;
                const response = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                    body: JSON.stringify({ email: createFormData.email, password: createFormData.password, nombre: createFormData.nombre, apellido: createFormData.apellido, telefono: createFormData.telefono, rol: createFormData.rol }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Error al crear usuario');
                toast.success('Usuario creado correctamente');
                await logActivity({ action: 'create', entityType: 'profile', entityName: createFormData.nombre, details: { ...createFormData, password: undefined } });
                setShowCreateModal(false);
                fetchProfiles();
            } catch (error: unknown) {
                toast.error((error instanceof Error ? error.message : String(error)));
            } finally {
                setProcessing(false);
            }
        }, 'Creando usuario...');
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProfile) return;

        const errors: Record<string, string> = {};
        if (!editFormData.nombre?.trim()) errors.nombre = 'El nombre es obligatorio';
        if (editFormData.telefono && !/^\d{9}$/.test(editFormData.telefono)) errors.telefono = 'El teléfono debe tener exactamente 9 dígitos';
        if (Object.keys(errors).length > 0) { setEditErrors(errors); return; }
        setEditErrors({});

        await withLoading(async () => {
            setProcessing(true);
            try {
                const session = (await supabase.auth.getSession()).data.session;
                const response = await fetch('/api/admin/update-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                    body: JSON.stringify({ userId: selectedProfile.user_id, email: editFormData.email, nombre: editFormData.nombre, apellido: editFormData.apellido, telefono: editFormData.telefono, rol: editFormData.rol }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Error al actualizar perfil');
                toast.success('Perfil actualizado correctamente');
                await logActivity({ action: 'update', entityType: 'profile', entityName: editFormData.nombre, details: { userId: selectedProfile.user_id, ...editFormData } });
                setShowEditModal(false);
                fetchProfiles();
            } catch (error: unknown) {
                toast.error((error instanceof Error ? error.message : String(error)));
            } finally {
                setProcessing(false);
            }
        }, 'Actualizando perfil...');
    };

    const handleSavePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedProfile) return;

        const errors: Record<string, string> = {};
        if (!passwordFormData.password) errors.password = 'La contraseña es obligatoria';
        else if (passwordFormData.password.length < 6) errors.password = 'La contraseña debe tener al menos 6 caracteres';
        if (passwordFormData.password !== passwordFormData.confirmPassword) errors.confirmPassword = 'Las contraseñas no coinciden';
        if (Object.keys(errors).length > 0) { setPasswordErrors(errors); return; }
        setPasswordErrors({});

        await withLoading(async () => {
            setProcessing(true);
            try {
                const session = (await supabase.auth.getSession()).data.session;
                const response = await fetch('/api/admin/update-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                    body: JSON.stringify({ userId: selectedProfile.user_id, password: passwordFormData.password }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Error al actualizar contraseña');
                toast.success('Contraseña actualizada correctamente');
                await logActivity({ action: 'update_password', entityType: 'profile', entityName: selectedProfile.nombre, details: { userId: selectedProfile.user_id } });
                setShowPasswordModal(false);
            } catch (error: unknown) {
                toast.error((error instanceof Error ? error.message : String(error)));
            } finally {
                setProcessing(false);
            }
        }, 'Actualizando contraseña...');
    };

    const handleToggleStatus = async (profile: Profile) => {
        if (!window.confirm(`¿Estás seguro de que deseas ${profile.activo ? 'desactivar' : 'activar'} a ${profile.nombre}?`)) return;

        await withLoading(async () => {
            try {
                const session = (await supabase.auth.getSession()).data.session;
                const response = await fetch('/api/admin/update-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                    body: JSON.stringify({ userId: profile.user_id, activo: !profile.activo }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Error al actualizar estado');
                toast.success(`Usuario ${profile.activo ? 'desactivado' : 'activado'} correctamente`);
                fetchProfiles();
                await logActivity({ action: 'toggle_active', entityType: 'profile', entityName: profile.nombre, details: { previousStatus: profile.activo, newStatus: !profile.activo } });
            } catch (error: unknown) {
                toast.error((error instanceof Error ? error.message : String(error)));
            }
        }, profile.activo ? 'Desactivando usuario...' : 'Activando usuario...');
    };

    const handleConfirmDelete = async ({ email, password }: any) => {
        if (!userToDelete || !email || !password) return;

        await withLoading(async () => {
            setIsDeleting(true);
            try {
                const res = await fetch('/api/admin/universal-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: userToDelete.user_id, email, password, type: 'perfil' })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error al eliminar');
                toast.success('Usuario eliminado correctamente');
                await logActivity({ action: 'delete', entityType: 'profile', entityId: 0, entityName: userToDelete.nombre, details: { deleted_by_admin: email } });
                setTimeout(() => window.location.reload(), 1000);
            } catch (error: unknown) {
                toast.error((error instanceof Error ? error.message : String(error)));
                setIsDeleting(false);
            }
        }, 'Eliminando usuario...');
    };

    const openDeleteModal = (profile: Profile) => {
        setUserToDelete(profile);
        setDeleteEmail('');
        setDeletePassword('');
        setDeleteModalOpen(true);
    };

    interface Profile {
        user_id: string;
        nombre: string;
        apellido?: string;
        email: string;
        telefono?: string;
        rol: 'admin' | 'empleado' | 'gestor';
        activo: boolean;
        created_at: string;
    }



    const columns: Column<Profile>[] = [
        {
            key: 'nombre',
            label: 'Nombre',
            render: (row) => (
                <div>
                    <div className="font-medium text-gray-900">{row.nombre} {row.apellido || ''}</div>
                    <div className="text-xs text-gray-400">ID: {row.user_id.slice(0, 8)}...</div>
                </div>
            ),
        },
        {
            key: 'telefono',
            label: 'Teléfono',
            render: (row) => <span className="text-gray-600">{row.telefono || '-'}</span>,
        },
        {
            key: 'email',
            label: 'Email',
            render: (row) => <span className="text-gray-600">{row.email}</span>,
        },
        {
            key: 'rol',
            label: 'Rol',
            render: (row) => (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize
                    ${row.rol === 'admin' ? 'bg-purple-100 text-purple-800' :
                        row.rol === 'gestor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {row.rol}
                </span>
            ),
        },
        {
            key: 'activo',
            label: 'Estado',
            render: (row) => (
                <button
                    onClick={() => handleToggleStatus(row)}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition hover:opacity-80
                    ${row.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                    title="Click para cambiar estado"
                >
                    {row.activo ? 'Activo' : 'Inactivo'}
                </button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-3">
                <h1 className="text-xl font-bold text-neutral-900 min-w-0 truncate">
                    Gestión de Perfiles
                </h1>
                <button
                    onClick={handleOpenCreate}
                    className="flex items-center gap-1.5 bg-[#bf4b50] text-white px-3 py-2 rounded-lg hover:bg-[#a03d42] transition font-medium shadow-sm flex-shrink-0"
                >
                    <UserPlus className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Nuevo Usuario</span>
                    <span className="sm:hidden">Nuevo</span>
                </button>
            </div>

            <DataTable
                data={profiles}
                columns={columns}
                keyExtractor={(row) => row.user_id}
                storageKey="perfiles"
                loading={loading}
                emptyMessage="No hay usuarios registrados"
                rowActions={(row) => [
                    { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: (r) => handleOpenEdit(r) },
                    { label: 'Restablecer Contraseña', icon: <KeyRound className="w-4 h-4" />, onClick: (r) => handleOpenPasswordReset(r) },
                    {
                        label: 'Eliminar',
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: (r) => openDeleteModal(r),
                        variant: 'danger',
                        separator: true,
                    },
                ]}
            />

            {/* Create User Modal */}
            {showCreateModal && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-[9999] backdrop-blur-sm sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-md w-full overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] flex flex-col animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/40">
                            <h3 className="text-lg font-bold text-neutral-900">
                                Crear Nuevo Usuario
                            </h3>
                            <button
                                onClick={() => { setShowCreateModal(false); setCreateErrors({}); }}
                                className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-4 sm:p-6 space-y-4" autoComplete="off">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Nombre</label>
                                    <input
                                        type="text"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition${createErrors.nombre ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={createFormData.nombre}
                                        onChange={e => { setCreateFormData({ ...createFormData, nombre: e.target.value }); setCreateErrors(prev => ({ ...prev, nombre: '' })); }}
                                        placeholder="Ej. Juan"
                                        autoComplete="off"
                                    />
                                    {createErrors.nombre && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{createErrors.nombre}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Apellido (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition"
                                        value={createFormData.apellido}
                                        onChange={e => setCreateFormData({ ...createFormData, apellido: e.target.value })}
                                        placeholder="Ej. Pérez"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Teléfono (Opcional)</label>
                                <input
                                    type="tel"
                                    className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition${createErrors.telefono ? 'border-red-400' : 'border-neutral-200'}`}
                                    value={createFormData.telefono}
                                    onChange={e => { setCreateFormData({ ...createFormData, telefono: e.target.value }); setCreateErrors(prev => ({ ...prev, telefono: '' })); }}
                                    placeholder="600 000 000"
                                    autoComplete="off"
                                />
                                {createErrors.telefono && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{createErrors.telefono}</p>}
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Email</label>
                                <input
                                    type="email"
                                    className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition${createErrors.email ? 'border-red-400' : 'border-neutral-200'}`}
                                    value={createFormData.email}
                                    onChange={e => { setCreateFormData({ ...createFormData, email: e.target.value }); setCreateErrors(prev => ({ ...prev, email: '' })); }}
                                    placeholder="usuario@serincosol.com"
                                    autoComplete="off"
                                />
                                {createErrors.email && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{createErrors.email}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Contraseña</label>
                                    <input
                                        type="password"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition${createErrors.password ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={createFormData.password}
                                        onChange={e => { setCreateFormData({ ...createFormData, password: e.target.value }); setCreateErrors(prev => ({ ...prev, password: '' })); }}
                                        placeholder="******"
                                        autoComplete="new-password"
                                    />
                                    {createErrors.password && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{createErrors.password}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Confirmar</label>
                                    <input
                                        type="password"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition${createErrors.confirmPassword ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={createFormData.confirmPassword}
                                        onChange={e => { setCreateFormData({ ...createFormData, confirmPassword: e.target.value }); setCreateErrors(prev => ({ ...prev, confirmPassword: '' })); }}
                                        placeholder="******"
                                        autoComplete="new-password"
                                    />
                                    {createErrors.confirmPassword && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{createErrors.confirmPassword}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Rol</label>
                                <SearchableSelect
                                    options={[
                                        { value: 'gestor', label: 'Gestor' },
                                        { value: 'admin', label: 'Administrador' },
                                    ]}
                                    value={createFormData.rol}
                                    onChange={v => setCreateFormData({ ...createFormData, rol: v as any })}
                                />
                                <p className="text-[10px] text-neutral-400 mt-1">
                                    {createFormData.rol === 'admin' ? '⚠️ Acceso total al sistema' :
                                        'ℹ️ Gestión de incidencias, morosidad y comunidades asignadas'}
                                </p>
                            </div>

                            <div className="pt-4 flex gap-3 justify-end border-t border-neutral-100 mt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowCreateModal(false); setCreateErrors({}); }}
                                    className="px-6 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-bold transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="px-6 py-2 bg-[#bf4b50] text-white rounded-lg hover:bg-[#a03d42] transition font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {processing ? (
                                        <>
                                            <span className="animate-spin h-4 w-4 border-2 border-neutral-950 border-t-transparent rounded-full"></span>
                                            Creando...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="w-4 h-4" />
                                            Crear Usuario
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            , document.body)}

            {/* Edit User Modal */}
            {showEditModal && selectedProfile && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-[9999] backdrop-blur-sm sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-md w-full overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] flex flex-col animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/40">
                            <h3 className="text-lg font-bold text-neutral-900">
                                Editar Usuario
                            </h3>
                            <button
                                onClick={() => { setShowEditModal(false); setEditErrors({}); }}
                                className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="p-4 sm:p-6 space-y-4" autoComplete="off">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Nombre</label>
                                    <input
                                        type="text"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition${editErrors.nombre ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={editFormData.nombre}
                                        onChange={e => { setEditFormData({ ...editFormData, nombre: e.target.value }); setEditErrors(prev => ({ ...prev, nombre: '' })); }}
                                    />
                                    {editErrors.nombre && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{editErrors.nombre}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Apellido</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition"
                                        value={editFormData.apellido}
                                        onChange={e => setEditFormData({ ...editFormData, apellido: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Teléfono</label>
                                <input
                                    type="tel"
                                    className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition${editErrors.telefono ? 'border-red-400' : 'border-neutral-200'}`}
                                    value={editFormData.telefono}
                                    onChange={e => { setEditFormData({ ...editFormData, telefono: e.target.value }); setEditErrors(prev => ({ ...prev, telefono: '' })); }}
                                />
                                {editErrors.telefono && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{editErrors.telefono}</p>}
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Email <span className="text-xs text-gray-400">(No editable)</span></label>
                                <input
                                    type="email"
                                    disabled
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-400 cursor-not-allowed"
                                    value={editFormData.email}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Rol</label>
                                <SearchableSelect
                                    options={[
                                        { value: 'gestor', label: 'Gestor' },
                                        { value: 'admin', label: 'Administrador' },
                                    ]}
                                    value={editFormData.rol}
                                    onChange={v => setEditFormData({ ...editFormData, rol: v as any })}
                                />
                            </div>

                            <div className="pt-4 flex gap-3 justify-end border-t border-neutral-100 mt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowEditModal(false); setEditErrors({}); }}
                                    className="px-6 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-bold transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="px-6 py-2 bg-[#bf4b50] text-white rounded-lg hover:bg-[#a03d42] transition font-bold shadow-sm disabled:opacity-50 flex items-center gap-2"
                                >
                                    {processing ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            , document.body)}

            {/* Password Reset Modal */}
            {showPasswordModal && selectedProfile && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-[9999] backdrop-blur-sm sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-sm w-full overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] flex flex-col animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/40">
                            <div>
                                <h3 className="text-lg font-bold text-neutral-900">
                                    Restablecer Contraseña
                                </h3>
                                <p className="text-xs text-gray-500">Para: {selectedProfile.nombre}</p>
                            </div>
                            <button
                                onClick={() => { setShowPasswordModal(false); setPasswordErrors({}); }}
                                className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSavePassword} className="p-4 sm:p-6 space-y-4" autoComplete="off">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Nueva Contraseña</label>
                                    <input
                                        type="password"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition${passwordErrors.password ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={passwordFormData.password}
                                        onChange={e => { setPasswordFormData({ ...passwordFormData, password: e.target.value }); setPasswordErrors(prev => ({ ...prev, password: '' })); }}
                                        placeholder="Min. 6 caracteres"
                                        autoComplete="new-password"
                                    />
                                    {passwordErrors.password && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{passwordErrors.password}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Confirmar</label>
                                    <input
                                        type="password"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition${passwordErrors.confirmPassword ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={passwordFormData.confirmPassword}
                                        onChange={e => { setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value }); setPasswordErrors(prev => ({ ...prev, confirmPassword: '' })); }}
                                        placeholder="Repetir contraseña"
                                        autoComplete="new-password"
                                    />
                                    {passwordErrors.confirmPassword && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{passwordErrors.confirmPassword}</p>}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3 justify-end border-t border-neutral-100 mt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowPasswordModal(false); setPasswordErrors({}); }}
                                    className="px-6 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-bold transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="px-6 py-2 bg-[#bf4b50] text-white rounded-lg hover:bg-[#a03d42] transition font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {processing ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            , document.body)}

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setUserToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                itemType="usuario"
                isDeleting={isDeleting}
                description={userToDelete ? `¿Estás seguro de que deseas ELIMINAR DEFINITIVAMENTE al usuario ${userToDelete.nombre.toUpperCase()}? Esta acción no se puede deshacer.` : undefined}
            />
        </div>
    );
}
