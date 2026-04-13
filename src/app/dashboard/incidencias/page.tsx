'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGlobalLoading } from '@/lib/globalLoading';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Trash2, FileText, Check, Plus, Download, RotateCcw, Loader2, Pause, Pencil } from 'lucide-react';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import DataTable from '@/components/DataTable';
import SearchableSelect from '@/components/SearchableSelect';
import { logActivity } from '@/lib/logActivity';
import { Incidencia, Profile, ComunidadOption } from '@/lib/schemas';
import { ImportPreviewData } from './types';
import { buildColumns } from './columns';
import IncidenciaFormModal from './IncidenciaFormModal';
import ExportModal from './ExportModal';
import DetailModal from './DetailModal';
import DeleteDocConfirmModal from './DeleteDocConfirmModal';
import ImportPreviewModal from './ImportPreviewModal';
import AplazarModal from './AplazarModal';

export default function IncidenciasPage() {
    const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
    const [comunidades, setComunidades] = useState<ComunidadOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [filterEstado, setFilterEstado] = useState('pendiente');
    const [filterGestor, setFilterGestor] = useState('all');
    const [filterComunidad, setFilterComunidad] = useState('all');

    // Selection & Export
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
    const [exporting, setExporting] = useState(false);

    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [enviarAviso, setEnviarAviso] = useState<boolean | null>(null);
    const [notifEmail, setNotifEmail] = useState(false);
    const [notifWhatsapp, setNotifWhatsapp] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<number | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isManualDate, setIsManualDate] = useState(false);

    const [formData, setFormData] = useState({
        comunidad_id: '',
        nombre_cliente: '',
        telefono: '',
        email: '',
        motivo_ticket: '',
        mensaje: '',
        recibido_por: '',
        gestor_asignado: '',
        proveedor: '',
        source: '',
        fecha_registro: new Date().toISOString().slice(0, 10),
    });

    // Delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [isReassigning, setIsReassigning] = useState(false);
    const [newGestorId, setNewGestorId] = useState('');
    const [isUpdatingGestor, setIsUpdatingGestor] = useState(false);
    const [showReassignSuccessModal, setShowReassignSuccessModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Detail Modal State
    const [selectedDetailIncidencia, setSelectedDetailIncidencia] = useState<Incidencia | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [isUpdatingRecord, setIsUpdatingRecord] = useState(false);
    const detailFileInputRef = useRef<HTMLInputElement>(null);
    const [importingPdf, setImportingPdf] = useState(false);
    const pdfImportInputRef = useRef<HTMLInputElement>(null);

    // PDF Notes Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [pendingExportParams, setPendingExportParams] = useState<{ type: 'csv' | 'pdf', ids?: number[], includeNotes?: boolean } | null>(null);

    // PDF Import Preview Modal State
    const [showImportPreviewModal, setShowImportPreviewModal] = useState(false);
    const [importPreviewData, setImportPreviewData] = useState<ImportPreviewData | null>(null);
    const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
    const [importRecordEstados, setImportRecordEstados] = useState<Record<number, 'Pendiente' | 'Resuelto'>>({});
    const [importRecordComunidades, setImportRecordComunidades] = useState<Record<number, number>>({});
    const [importReceptorName, setImportReceptorName] = useState<string>('');

    // Document Delete Confirmation
    const [showDeleteDocConfirm, setShowDeleteDocConfirm] = useState(false);
    const [urlToConfirmDelete, setUrlToConfirmDelete] = useState<string | null>(null);

    // Aplazar (Postpone) Modal State
    const [showAplazarModal, setShowAplazarModal] = useState(false);
    const [aplazarIncidenciaId, setAplazarIncidenciaId] = useState<number | null>(null);
    const [aplazarDate, setAplazarDate] = useState('');

    // Portal ready (client-only)
    const [portalReady, setPortalReady] = useState(false);

    const { withLoading } = useGlobalLoading();

    const handleRowClick = (incidencia: Incidencia) => {
        setSelectedDetailIncidencia(incidencia);
        setShowDetailModal(true);
    };

    useEffect(() => {
        fetchInitialData();

        const channel = supabase
            .channel('incidencias-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'incidencias' },
                () => { fetchIncidencias(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    useEffect(() => setPortalReady(true), []);

    useEffect(() => {
        if (showForm || showDeleteModal || showExportModal || showDetailModal || showImportPreviewModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showForm, showDeleteModal, showExportModal, showDetailModal, showImportPreviewModal]);

    const fetchInitialData = async () => {
        setLoading(true);
        await Promise.all([fetchComunidades(), fetchIncidencias(), fetchProfiles()]);
        setLoading(false);
    };

    const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('user_id, nombre, rol').eq('activo', true);
        if (data) setProfiles(data);
    };

    const fetchComunidades = async () => {
        const { data } = await supabase.from('comunidades').select('id, nombre_cdad, codigo').eq('activo', true).order('codigo', { ascending: true });
        if (data) setComunidades(data);
    };

    const fetchIncidencias = async () => {
        const { data, error } = await supabase
            .from('incidencias')
            .select(`*, comunidades (nombre_cdad, codigo), receptor:profiles!quien_lo_recibe (nombre), gestor:profiles!gestor_asignado (nombre), resolver:profiles!resuelto_por (nombre)`)
            .order('created_at', { ascending: false })
            .limit(5000);

        if (error) {
            toast.error('Error cargando incidencias');
        } else {
            const formattedData = (data || []).map((item: any) => ({
                ...item,
                comunidad: item.comunidades?.nombre_cdad || '',
                codigo: item.comunidades?.codigo || ''
            }));
            setIncidencias(formattedData);
        }
    };

    const closeImportModal = () => {
        setShowImportPreviewModal(false);
        setPendingImportFile(null);
        setImportPreviewData(null);
        setImportRecordEstados({});
        setImportRecordComunidades({});
        setImportReceptorName('');
        if (pdfImportInputRef.current) pdfImportInputRef.current.value = '';
    };

    const handleImportPdf = async (file: File) => {
        await withLoading(async () => {
            setImportingPdf(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('No hay sesión activa');
                const receptorProfile = profiles.find(p => p.user_id === user.id);
                const payload = new FormData();
                payload.append('pdf', file);
                payload.append('receptor_id', user.id);
                const response = await fetch('/api/incidencias/import-pdf?dryRun=true', { method: 'POST', body: payload });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Error al procesar el PDF');
                setPendingImportFile(file);
                setImportPreviewData(result);
                setImportReceptorName(receptorProfile?.nombre ?? user.email ?? '');
                setShowImportPreviewModal(true);
            } catch (error) {
                console.error('Error al importar PDF:', error);
                toast.error(error instanceof Error ? error.message : 'Error al procesar el PDF');
                if (pdfImportInputRef.current) pdfImportInputRef.current.value = '';
            } finally {
                setImportingPdf(false);
            }
        }, 'Procesando PDF...');
    };

    const handleConfirmImport = async () => {
        if (!pendingImportFile || !importPreviewData) return;
        setShowImportPreviewModal(false);
        await withLoading(async () => {
            setImportingPdf(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('No hay sesión activa');

                const estadosArray: string[] = [];
                const comunidadesOverride: Record<number, number> = {};
                let okIndex = 0;
                importPreviewData.records.forEach((rec, idx) => {
                    if (rec.status === 'ok') {
                        estadosArray.push(importRecordEstados[idx] || 'Pendiente');
                        okIndex++;
                    } else if (rec.status === 'skip' && rec.comunidad_not_found && importRecordComunidades[idx]) {
                        estadosArray.push(importRecordEstados[idx] || 'Pendiente');
                        comunidadesOverride[okIndex] = importRecordComunidades[idx];
                        okIndex++;
                    }
                });

                const payload = new FormData();
                payload.append('pdf', pendingImportFile);
                payload.append('receptor_id', user.id);
                payload.append('estados', JSON.stringify(estadosArray));
                payload.append('comunidades_override', JSON.stringify(comunidadesOverride));

                const response = await fetch('/api/incidencias/import-pdf', { method: 'POST', body: payload });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Error al importar el PDF');
                toast.success(
                    `PDF importado: ${result.inserted} registros insertados de ${result.total_parsed} encontrados` +
                    (result.skipped > 0 ? ` (${result.skipped} omitidos)` : '')
                );
                fetchIncidencias();
            } catch (error) {
                console.error('Error al importar PDF:', error);
                toast.error(error instanceof Error ? error.message : 'Error al importar el PDF');
            } finally {
                setImportingPdf(false);
                setPendingImportFile(null);
                setImportPreviewData(null);
                setImportRecordEstados({});
                setImportRecordComunidades({});
                if (pdfImportInputRef.current) pdfImportInputRef.current.value = '';
            }
        }, 'Importando incidencias...');
    };

    const handleFileUploads = async () => {
        if (files.length === 0) return [];
        setUploading(true);
        const urls: string[] = [];
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('path', `incidencias/${Date.now()}`);
                formData.append('bucket', 'documentos');
                const res = await fetch('/api/storage/upload', { method: 'POST', body: formData });
                if (!res.ok) { const error = await res.json(); console.error('Error uploading file via API:', error); continue; }
                const data = await res.json();
                if (data.publicUrl) urls.push(data.publicUrl);
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Error al subir algunos archivos');
        } finally {
            setUploading(false);
        }
        return urls;
    };

    const handleEdit = (incidencia: Incidencia) => {
        setEditingId(incidencia.id);
        setFormData({
            comunidad_id: incidencia.comunidad_id?.toString() || '',
            nombre_cliente: incidencia.nombre_cliente || '',
            telefono: incidencia.telefono || '',
            email: incidencia.email || '',
            motivo_ticket: incidencia.motivo_ticket || '',
            mensaje: incidencia.mensaje || '',
            recibido_por: incidencia.quien_lo_recibe || '',
            gestor_asignado: incidencia.gestor_asignado || '',
            proveedor: '',
            source: incidencia.source || '',
            fecha_registro: incidencia.created_at ? new Date(incidencia.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        });
        setIsManualDate(false);
        setEnviarAviso(false);
        setFiles([]);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors: Record<string, string> = {};
        if (!formData.comunidad_id) errors.comunidad_id = 'Debes seleccionar una comunidad para poder guardar';
        if (!formData.nombre_cliente?.trim()) errors.nombre_cliente = 'El nombre del propietario es obligatorio';
        if (!formData.recibido_por) errors.recibido_por = 'Debes indicar quién recibió la incidencia';
        if (!formData.gestor_asignado) errors.gestor_asignado = 'Debes asignar un gestor para poder guardar el ticket';
        if (!formData.source) errors.source = 'Debes indicar la entrada del ticket';
        if (!formData.motivo_ticket?.trim()) errors.motivo_ticket = 'El motivo del ticket es obligatorio';
        if (!formData.mensaje?.trim()) errors.mensaje = 'El mensaje de la incidencia es obligatorio';

        const phoneRegex = /^\d{9}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.telefono && !phoneRegex.test(formData.telefono)) errors.telefono = 'El teléfono debe tener exactamente 9 dígitos sin espacios';
        if (formData.email && !emailRegex.test(formData.email)) errors.email = 'El formato del email no es válido';
        if (!editingId && enviarAviso === true && !notifEmail && !notifWhatsapp) errors.canal = 'Selecciona al menos un canal de notificación (Email o WhatsApp)';
        if (!editingId && enviarAviso === true && notifEmail && !formData.email) errors.contacto = 'Para notificar por email debes proporcionar un Email';
        if (!editingId && enviarAviso === true && notifWhatsapp && !formData.telefono) errors.contacto = (errors.contacto ? errors.contacto + ' y ' : '') + 'Para notificar por WhatsApp debes proporcionar un Teléfono';

        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
        setFormErrors({});

        if (isSubmitting) return;

        await withLoading(async () => {
            setIsSubmitting(true);
            const loadingToastId = toast.loading(editingId ? 'Actualizando ticket...' : 'Creando ticket... espere');

            try {
                const adjuntos = await handleFileUploads();
                const comunidad = comunidades.find(c => c.id === parseInt(formData.comunidad_id));

                if (editingId) {
                    const updatePayload: any = {
                        comunidad_id: parseInt(formData.comunidad_id),
                        nombre_cliente: formData.nombre_cliente,
                        telefono: formData.telefono,
                        email: formData.email,
                        motivo_ticket: formData.motivo_ticket || null,
                        mensaje: formData.mensaje,
                        quien_lo_recibe: formData.recibido_por || null,
                        gestor_asignado: formData.gestor_asignado || null,
                        source: formData.source || null,
                    };

                    if (formData.fecha_registro) {
                        const existing = incidencias.find(i => i.id === editingId);
                        const originalDate = existing?.created_at ? new Date(existing.created_at).toISOString().slice(0, 10) : '';
                        if (formData.fecha_registro !== originalDate) {
                            updatePayload.created_at = new Date(formData.fecha_registro).toISOString();
                        }
                    }

                    if (adjuntos.length > 0) {
                        const existing = incidencias.find(i => i.id === editingId);
                        updatePayload.adjuntos = [...(existing?.adjuntos || []), ...adjuntos];
                    }

                    const { error } = await supabase.from('incidencias').update(updatePayload).eq('id', editingId);
                    if (error) throw error;

                    toast.success('Ticket actualizado');
                    const gestorAsignado = profiles.find(p => p.user_id === formData.gestor_asignado);
                    await logActivity({ action: 'update', entityType: 'incidencia', entityId: editingId, entityName: `Incidencia - ${formData.nombre_cliente}`, details: { id: editingId, action: 'edit', comunidad: comunidad?.nombre_cdad, mensaje: formData.mensaje, asignado_a: gestorAsignado?.nombre || formData.gestor_asignado } });
                } else {
                    const { data: insertedData, error } = await supabase.from('incidencias').insert([{
                        comunidad_id: parseInt(formData.comunidad_id),
                        nombre_cliente: formData.nombre_cliente,
                        telefono: formData.telefono,
                        email: formData.email,
                        motivo_ticket: formData.motivo_ticket || null,
                        mensaje: formData.mensaje,
                        quien_lo_recibe: formData.recibido_por || null,
                        // @ts-ignore
                        adjuntos: adjuntos,
                        // @ts-ignore
                        gestor_asignado: formData.gestor_asignado || null,
                        aviso: (!notifEmail && !notifWhatsapp) ? 0 : (notifWhatsapp && !notifEmail) ? 1 : (!notifWhatsapp && notifEmail) ? 2 : 3,
                        source: formData.source || null,
                        ...(formData.fecha_registro ? { created_at: new Date(formData.fecha_registro).toISOString() } : {})
                    }]).select();

                    if (error) throw error;

                    const incidenciaId = insertedData?.[0]?.id;
                    toast.success('Incidencia creada');
                    const gestorAsignado = profiles.find(p => p.user_id === formData.gestor_asignado);
                    await logActivity({ action: 'create', entityType: 'incidencia', entityId: incidenciaId, entityName: `Incidencia - ${formData.nombre_cliente}`, details: { id: incidenciaId, comunidad: comunidad?.nombre_cdad, mensaje: formData.mensaje, asignado_a: gestorAsignado?.nombre || formData.gestor_asignado } });
                }

                setShowForm(false);
                setEditingId(null);
                setFormData({ comunidad_id: '', nombre_cliente: '', telefono: '', email: '', motivo_ticket: '', mensaje: '', recibido_por: '', gestor_asignado: '', proveedor: '', source: '', fecha_registro: '' });
                setFiles([]);
                setEnviarAviso(null);
                setNotifEmail(false);
                setNotifWhatsapp(false);
                fetchIncidencias();
            } catch (error: any) {
                toast.error('Error: ' + error.message);
            } finally {
                toast.dismiss(loadingToastId);
                setIsSubmitting(false);
            }
        }, 'Guardando incidencia...');
    };

    const handleDetailFileUpload = async (uploadFiles: FileList) => {
        if (!selectedDetailIncidencia) return;
        await withLoading(async () => {
            setIsUpdatingRecord(true);
            const loadingToast = toast.loading('Subiendo archivos...');
            try {
                const newUrls: string[] = [];
                for (let i = 0; i < uploadFiles.length; i++) {
                    const file = uploadFiles[i];
                    const fd = new FormData();
                    fd.append('file', file);
                    fd.append('path', `incidencias/${selectedDetailIncidencia.id}`);
                    fd.append('bucket', 'documentos');
                    const res = await fetch('/api/storage/upload', { method: 'POST', body: fd });
                    if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Error al subir archivo'); }
                    const data = await res.json();
                    if (data.publicUrl) newUrls.push(data.publicUrl);
                }

                const updatedAdjuntos = [...(selectedDetailIncidencia.adjuntos || []), ...newUrls];
                const { error: updateError } = await supabase.from('incidencias').update({ adjuntos: updatedAdjuntos }).eq('id', selectedDetailIncidencia.id);
                if (updateError) throw updateError;

                setSelectedDetailIncidencia({ ...selectedDetailIncidencia, adjuntos: updatedAdjuntos });
                setIncidencias(prev => prev.map(i => i.id === selectedDetailIncidencia.id ? { ...i, adjuntos: updatedAdjuntos } : i));

                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('record_messages').insert([{ entity_type: 'incidencia', entity_id: selectedDetailIncidencia.id, user_id: user.id, content: `📎 SE HAN ADJUNTO ${newUrls.length} NUEVOS DOCUMENTOS AL TICKET.` }]);
                }
                await logActivity({ action: 'update', entityType: 'incidencia', entityId: selectedDetailIncidencia.id, entityName: `Incidencia - ${selectedDetailIncidencia.nombre_cliente}`, details: { acción: 'Documentos adjuntos añadidos', cantidad_nuevos: newUrls.length, total_documentos: updatedAdjuntos.length, comunidad: selectedDetailIncidencia.comunidades?.nombre_cdad || selectedDetailIncidencia.comunidad || 'N/A' } });
                toast.success('Archivos añadidos hoy', { id: loadingToast });
            } catch (error: any) {
                console.error(error);
                toast.error('Error al subir archivos', { id: loadingToast });
            } finally {
                setIsUpdatingRecord(false);
            }
        }, 'Subiendo archivos...');
    };

    const handleDeleteAttachment = async () => {
        if (!selectedDetailIncidencia || !urlToConfirmDelete) return;
        setShowDeleteDocConfirm(false);
        const urlToDelete = urlToConfirmDelete;
        setUrlToConfirmDelete(null);

        await withLoading(async () => {
            setIsUpdatingRecord(true);
            const loadingToast = toast.loading('Eliminando archivo...');
            try {
                let bucket = 'documentos';
                let path = '';

                if (urlToDelete.includes('/api/storage/view')) {
                    const urlObj = new URL(urlToDelete, window.location.origin);
                    bucket = urlObj.searchParams.get('bucket') || 'documentos';
                    path = urlObj.searchParams.get('path') || '';
                } else if (urlToDelete.includes('.supabase.co/storage/v1/object/public/')) {
                    const parts = urlToDelete.split('/object/public/')[1].split('/');
                    bucket = parts[0];
                    path = parts.slice(1).join('/');
                }

                if (path) {
                    const res = await fetch('/api/storage/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bucket, path }) });
                    if (!res.ok) { const error = await res.json(); console.warn('[Storage Delete] Could not delete file from storage:', error.error); }
                }

                const updatedAdjuntos = (selectedDetailIncidencia.adjuntos || []).filter(url => url !== urlToDelete);
                const { error: updateError } = await supabase.from('incidencias').update({ adjuntos: updatedAdjuntos }).eq('id', selectedDetailIncidencia.id);
                if (updateError) throw updateError;

                setSelectedDetailIncidencia({ ...selectedDetailIncidencia, adjuntos: updatedAdjuntos });
                setIncidencias(prev => prev.map(i => i.id === selectedDetailIncidencia.id ? { ...i, adjuntos: updatedAdjuntos } : i));

                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('record_messages').insert([{ entity_type: 'incidencia', entity_id: selectedDetailIncidencia.id, user_id: user.id, content: `🗑️ SE HA ELIMINADO UN DOCUMENTO ADJUNTO DEL TICKET.` }]);
                }
                await logActivity({ action: 'update', entityType: 'incidencia', entityId: selectedDetailIncidencia.id, entityName: `Incidencia - ${selectedDetailIncidencia.nombre_cliente}`, details: { acción: 'Documento adjunto eliminado', comunidad: selectedDetailIncidencia.comunidades?.nombre_cdad || selectedDetailIncidencia.comunidad || 'N/A' } });
                toast.success('Documento eliminado', { id: loadingToast });
            } catch (error: any) {
                console.error(error);
                toast.error('Error al eliminar el documento', { id: loadingToast });
            } finally {
                setIsUpdatingRecord(false);
            }
        }, 'Eliminando adjunto...');
    };

    const toggleResuelto = async (id: number, currentStatus: boolean) => {
        if (isUpdatingStatus === id) return;
        await withLoading(async () => {
            setIsUpdatingStatus(id);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const newResuelto = !currentStatus;
                const newEstado = newResuelto ? 'Resuelto' : 'Pendiente';
                const { error } = await supabase.from('incidencias').update({ resuelto: newResuelto, estado: newEstado, dia_resuelto: newResuelto ? new Date().toISOString() : null, resuelto_por: newResuelto ? user?.id : null, fecha_recordatorio: null }).eq('id', id);
                if (error) throw error;

                toast.success(currentStatus ? 'Marcado como pendiente' : 'Marcado como resuelto');
                setIncidencias(prev => prev.map(i => i.id === id ? { ...i, resuelto: newResuelto, estado: newEstado as any, dia_resuelto: newResuelto ? new Date().toISOString() : undefined, resuelto_por: newResuelto ? user?.id : undefined, fecha_recordatorio: undefined } : i));

                const incidencia = incidencias.find(i => i.id === id);
                await logActivity({ action: 'update', entityType: 'incidencia', entityId: id, entityName: `Incidencia - ${incidencia?.nombre_cliente}`, details: { id, comunidad: incidencia?.comunidades?.nombre_cdad, resuelto: newResuelto, estado: newEstado } });
            } catch (error) {
                console.error(error);
                toast.error('Error al actualizar estado');
            } finally {
                setIsUpdatingStatus(null);
            }
        }, currentStatus ? 'Reabriendo incidencia...' : 'Resolviendo incidencia...');
    };

    const reactivarDesdeAplazado = async (id: number) => {
        if (isUpdatingStatus === id) return;
        await withLoading(async () => {
            setIsUpdatingStatus(id);
            try {
                const { error } = await supabase.from('incidencias').update({ estado: 'Pendiente', fecha_recordatorio: null }).eq('id', id);
                if (error) throw error;
                toast.success('Ticket vuelto a Pendiente');
                setIncidencias(prev => prev.map(i => i.id === id ? { ...i, estado: 'Pendiente' as any, fecha_recordatorio: undefined } : i));
            } catch (error) {
                console.error(error);
                toast.error('Error al reactivar ticket');
            } finally {
                setIsUpdatingStatus(null);
            }
        }, 'Reactivando ticket...');
    };

    const openAplazarModal = (id: number) => {
        setAplazarIncidenciaId(id);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setAplazarDate(tomorrow.toISOString().slice(0, 10));
        setShowAplazarModal(true);
    };

    const aplazarTicket = async () => {
        if (!aplazarIncidenciaId || !aplazarDate) return;
        await withLoading(async () => {
            const loadingToast = toast.loading('Aplazando ticket...');
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const { error } = await supabase.from('incidencias').update({ estado: 'Aplazado', resuelto: false, fecha_recordatorio: aplazarDate }).eq('id', aplazarIncidenciaId);
                if (error) throw error;

                const fechaFormateada = new Date(aplazarDate + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

                if (user) {
                    await supabase.from('record_messages').insert([{ entity_type: 'incidencia', entity_id: aplazarIncidenciaId, user_id: user.id, content: `⏱️ TICKET APLAZADO HASTA: ${fechaFormateada}` }]);
                }

                const incidencia = incidencias.find(i => i.id === aplazarIncidenciaId);
                await logActivity({ action: 'update', entityType: 'incidencia', entityId: aplazarIncidenciaId, entityName: `Incidencia - ${incidencia?.nombre_cliente}`, details: { acción: 'Ticket aplazado', fecha_recordatorio: fechaFormateada, comunidad: incidencia?.comunidades?.nombre_cdad || incidencia?.comunidad || 'N/A' } });

                setIncidencias(prev => prev.map(i => i.id === aplazarIncidenciaId ? { ...i, estado: 'Aplazado' as any, resuelto: false, fecha_recordatorio: aplazarDate } : i));

                if (selectedDetailIncidencia && selectedDetailIncidencia.id === aplazarIncidenciaId) {
                    setSelectedDetailIncidencia({ ...selectedDetailIncidencia, estado: 'Aplazado', resuelto: false, fecha_recordatorio: aplazarDate });
                }

                toast.success(`Ticket aplazado hasta ${fechaFormateada}`, { id: loadingToast });
                setShowAplazarModal(false);
                setAplazarIncidenciaId(null);
                setAplazarDate('');
            } catch (error: any) {
                console.error(error);
                toast.error('Error al aplazar el ticket', { id: loadingToast });
            }
        }, 'Aplazando ticket...');
    };

    const handleExport = async (type: 'csv' | 'pdf', idsOverride?: number[], includeNotesFromModal?: boolean) => {
        const idsToExport = idsOverride || Array.from(selectedIds);
        if (idsToExport.length === 0) return;

        const isDetailView = !!idsOverride && idsToExport.length === 1 && type === 'pdf';

        if (isDetailView && includeNotesFromModal === undefined) {
            setPendingExportParams({ type, ids: idsOverride });
            setShowExportModal(true);
            return;
        }

        const includeNotes = includeNotesFromModal !== undefined ? includeNotesFromModal : false;
        const label = type === 'pdf' ? 'Generando PDF...' : 'Exportando CSV...';

        await withLoading(async () => {
            setExporting(true);
            try {
                const res = await fetch('/api/incidencias/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: idsToExport, type, layout: isDetailView ? 'detail' : 'list', includeNotes }) });
                if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || 'Export failed'); }

                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                const now = new Date();
                const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
                a.download = isDetailView ? `ticket_${idsToExport[0]}_${dateStr}.pdf` : `listado_incidencias_${dateStr}.${type === 'csv' ? 'csv' : 'pdf'}`;

                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success('Exportación completada');
            } catch (error) {
                console.error(error);
                toast.error('Error al exportar');
            } finally {
                setExporting(false);
            }
        }, label);
    };

    const handleDeleteClick = (id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async ({ email, password }: any) => {
        if (!itemToDelete || !email || !password) return;
        await withLoading(async () => {
            setIsDeleting(true);
            try {
                const res = await fetch('/api/admin/universal-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: itemToDelete, email, password, type: 'incidencia' }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error al eliminar');

                toast.success('Incidencia eliminada correctamente');
                setIncidencias(prev => prev.filter(i => i.id !== itemToDelete));
                setShowDeleteModal(false);
                setItemToDelete(null);
                await logActivity({ action: 'delete', entityType: 'incidencia', entityId: itemToDelete, entityName: `Incidencia Deleted`, details: { id: itemToDelete, deleted_by_admin: email } });
            } catch (error: any) {
                toast.error(error.message);
            } finally {
                setIsDeleting(false);
            }
        }, 'Eliminando incidencia...');
    };

    const handleUpdateGestor = async () => {
        if (!selectedDetailIncidencia || !newGestorId) return;
        await withLoading(async () => {
            setIsUpdatingGestor(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Usuario no autenticado');

                const { error } = await supabase.from('incidencias').update({ gestor_asignado: newGestorId }).eq('id', selectedDetailIncidencia.id);
                if (error) throw error;

                const newGestorProfile = profiles.find(p => p.user_id === newGestorId);
                const oldGestorName = selectedDetailIncidencia.gestor?.nombre || 'Sin asignar';
                const newGestorName = newGestorProfile?.nombre || 'Desconocido';

                setSelectedDetailIncidencia({ ...selectedDetailIncidencia, gestor_asignado: newGestorId, gestor: newGestorProfile ? { nombre: newGestorProfile.nombre } : selectedDetailIncidencia.gestor });
                setIncidencias(prev => prev.map(inc => inc.id === selectedDetailIncidencia.id ? { ...inc, gestor_asignado: newGestorId, gestor: newGestorProfile ? { nombre: newGestorProfile.nombre } : inc.gestor } : inc));

                await supabase.from('record_messages').insert({ entity_type: 'incidencia', entity_id: selectedDetailIncidencia.id, user_id: user.id, content: `🔄 TICKET REASIGNADO\nDe: ${oldGestorName}\nA: ${newGestorName}` });

                if (newGestorId !== user.id) {
                    await supabase.from('notifications').insert({ user_id: newGestorId, type: 'assignment', title: 'Nueva Asignación de Ticket', content: `Se te ha asignado la incidencia #${selectedDetailIncidencia.id} (Reasignado por reasignación)`, entity_id: selectedDetailIncidencia.id, entity_type: 'incidencia', link: `/dashboard/incidencias?id=${selectedDetailIncidencia.id}`, is_read: false });
                }

                await logActivity({ action: 'update', entityType: 'incidencia', entityId: selectedDetailIncidencia.id, entityName: `Incidencia #${selectedDetailIncidencia.id}`, details: { change: 'reasignacion', old_gestor: oldGestorName, new_gestor: newGestorName, by: user.id } });

                setIsReassigning(false);
                setNewGestorId('');
                setShowReassignSuccessModal(true);
            } catch (error: any) {
                console.error('Error updating gestor:', error);
                toast.error('Error al reasignar gestor');
            } finally {
                setIsUpdatingGestor(false);
            }
        }, 'Reasignando gestor...');
    };

    const filteredIncidencias = incidencias.filter(inc => {
        const estado = inc.estado || (inc.resuelto ? 'Resuelto' : 'Pendiente');
        const matchesEstado =
            filterEstado === 'pendiente' ? estado === 'Pendiente' :
            filterEstado === 'resuelto' ? estado === 'Resuelto' :
            filterEstado === 'aplazado' ? estado === 'Aplazado' : true;

        const matchesGestor = filterGestor === 'all' ? true : inc.gestor_asignado === filterGestor;
        const matchesComunidad = filterComunidad === 'all' ? true : inc.comunidad_id === Number(filterComunidad);

        return matchesEstado && matchesGestor && matchesComunidad;
    });

    const columns = buildColumns(profiles);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-3">
                <h1 className="text-xl font-bold text-neutral-900">Gestión de Tickets</h1>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                        ref={pdfImportInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImportPdf(file); }}
                    />
                    <button
                        onClick={() => pdfImportInputRef.current?.click()}
                        disabled={importingPdf}
                        className="bg-neutral-200 hover:bg-neutral-300 text-neutral-800 px-3 py-2 rounded-md flex items-center gap-1.5 transition font-semibold text-sm disabled:opacity-50"
                    >
                        {importingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 flex-shrink-0" />}
                        <span className="hidden sm:inline">Importar desde PDF</span>
                        <span className="sm:hidden">Importar</span>
                    </button>
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setFormData({ comunidad_id: '', nombre_cliente: '', telefono: '', email: '', motivo_ticket: '', mensaje: '', recibido_por: '', gestor_asignado: '', proveedor: '', source: '', fecha_registro: new Date().toISOString().slice(0, 10) });
                            setIsManualDate(false);
                            setEnviarAviso(null);
                            setNotifEmail(false);
                            setNotifWhatsapp(false);
                            setFiles([]);
                            setFormErrors({});
                            setShowForm(!showForm);
                        }}
                        className="bg-[#bf4b50] hover:bg-[#a03d42] text-white px-3 py-2 rounded-md flex items-center gap-1.5 transition font-semibold text-sm"
                    >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Nuevo Ticket</span>
                        <span className="sm:hidden">Ticket</span>
                    </button>
                </div>
            </div>

            {/* Filters and Actions */}
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-2">
                    <button onClick={() => setFilterEstado('pendiente')} className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterEstado === 'pendiente' ? 'bg-[#bf4b50] text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}>Pendientes</button>
                    <button onClick={() => setFilterEstado('aplazado')} className={`px-3 py-1 rounded-full text-sm font-medium transition flex items-center justify-center gap-1.5 ${filterEstado === 'aplazado' ? 'bg-orange-400 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}><Pause className="w-3 h-3" />Aplazadas</button>
                    <button onClick={() => setFilterEstado('resuelto')} className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterEstado === 'resuelto' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}>Resueltas</button>
                    <button onClick={() => setFilterEstado('all')} className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterEstado === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}>Todas</button>
                </div>

                {selectedIds.size > 0 && (
                    <div className="flex gap-2 items-center animate-in fade-in slide-in-from-bottom-2">
                        <span className="text-sm font-medium text-neutral-500 mr-2">{selectedIds.size} seleccionados</span>
                        <button onClick={() => handleExport('csv')} disabled={exporting} className="bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition disabled:opacity-50">
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-green-600" />}CSV
                        </button>
                        <button onClick={() => handleExport('pdf')} disabled={exporting} className="bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition disabled:opacity-50">
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-red-600" />}PDF
                        </button>
                    </div>
                )}
            </div>

            {/* Form Modal */}
            {portalReady && (
                <IncidenciaFormModal
                    show={showForm}
                    editingId={editingId}
                    formData={formData}
                    formErrors={formErrors}
                    files={files}
                    uploading={uploading}
                    isSubmitting={isSubmitting}
                    isManualDate={isManualDate}
                    enviarAviso={enviarAviso}
                    notifEmail={notifEmail}
                    notifWhatsapp={notifWhatsapp}
                    comunidades={comunidades}
                    profiles={profiles}
                    onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
                    onFilesChange={setFiles}
                    onSubmit={handleSubmit}
                    onClose={() => setShowForm(false)}
                    setEnviarAviso={setEnviarAviso}
                    setNotifEmail={setNotifEmail}
                    setNotifWhatsapp={setNotifWhatsapp}
                    setIsManualDate={setIsManualDate}
                    setFormErrors={setFormErrors}
                />
            )}

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => { setShowDeleteModal(false); setItemToDelete(null); }}
                onConfirm={handleConfirmDelete}
                itemType="incidencia"
                isDeleting={isDeleting}
            />

            {/* Export Notes Modal */}
            {portalReady && (
                <ExportModal
                    show={showExportModal}
                    pendingExportParams={pendingExportParams}
                    onConfirm={(includeNotes) => {
                        const params = pendingExportParams;
                        setPendingExportParams(null);
                        setShowExportModal(false);
                        if (params) handleExport(params.type, params.ids, includeNotes);
                    }}
                    onClose={() => { setPendingExportParams(null); setShowExportModal(false); }}
                />
            )}

            <DataTable
                data={filteredIncidencias}
                columns={columns}
                keyExtractor={(row) => row.id}
                storageKey="incidencias"
                loading={loading}
                emptyMessage="No hay incidencias en esta vista"
                selectable={true}
                selectedKeys={selectedIds}
                onSelectionChange={(keys) => setSelectedIds(keys)}
                onRowClick={handleRowClick}
                extraFilters={
                    <>
                        <SearchableSelect
                            value={filterComunidad === 'all' ? '' : Number(filterComunidad)}
                            onChange={(val) => setFilterComunidad(val === '' ? 'all' : String(val))}
                            options={comunidades.map(c => ({ value: c.id, label: `${c.codigo || ''} - ${c.nombre_cdad}` }))}
                            placeholder="Todas las Comunidades"
                            className="w-[200px]"
                        />
                        <SearchableSelect
                            value={filterGestor === 'all' ? '' : filterGestor}
                            onChange={(val) => setFilterGestor(val === '' ? 'all' : String(val))}
                            options={profiles.map(p => ({ value: p.user_id, label: p.nombre }))}
                            placeholder="Todos los Gestores"
                            className="w-[170px]"
                        />
                    </>
                }
                rowActions={(row) => {
                    const estado = row.estado || (row.resuelto ? 'Resuelto' : 'Pendiente');
                    return [
                        { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: (r) => handleEdit(r) },
                        { label: estado === 'Resuelto' ? 'Reabrir' : (estado === 'Aplazado' ? 'Volver a Pendiente' : 'Resolver'), icon: estado === 'Resuelto' ? <RotateCcw className="w-4 h-4" /> : <Check className="w-4 h-4" />, onClick: (r) => estado === 'Aplazado' ? reactivarDesdeAplazado(r.id) : toggleResuelto(r.id, r.resuelto), disabled: isUpdatingStatus === row.id, variant: estado === 'Resuelto' ? 'default' : 'success' },
                        { label: 'Aplazar', icon: <Pause className="w-4 h-4" />, onClick: (r) => openAplazarModal(r.id), hidden: estado === 'Resuelto' || estado === 'Aplazado', variant: 'warning' },
                        { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: (r) => handleDeleteClick(r.id), variant: 'danger', separator: true },
                    ];
                }}
            />

            {/* Detail Modal */}
            {portalReady && (
                <DetailModal
                    show={showDetailModal}
                    selectedDetailIncidencia={selectedDetailIncidencia}
                    profiles={profiles}
                    comunidades={comunidades}
                    isUpdatingRecord={isUpdatingRecord}
                    isUpdatingGestor={isUpdatingGestor}
                    isReassigning={isReassigning}
                    newGestorId={newGestorId}
                    exporting={exporting}
                    showReassignSuccessModal={showReassignSuccessModal}
                    detailFileInputRef={detailFileInputRef}
                    onClose={() => setShowDetailModal(false)}
                    onDetailFileUpload={handleDetailFileUpload}
                    onDeleteAttachmentRequest={(url) => { setUrlToConfirmDelete(url); setShowDeleteDocConfirm(true); }}
                    onToggleResuelto={toggleResuelto}
                    onDeleteClick={handleDeleteClick}
                    onExport={handleExport}
                    onOpenAplazar={openAplazarModal}
                    onUpdateGestor={handleUpdateGestor}
                    setIsReassigning={setIsReassigning}
                    setNewGestorId={setNewGestorId}
                    setSelectedDetailIncidencia={setSelectedDetailIncidencia as any}
                    setShowReassignSuccessModal={setShowReassignSuccessModal}
                    setShowDetailModal={setShowDetailModal}
                />
            )}

            {/* Document Delete Confirmation Modal */}
            {portalReady && (
                <DeleteDocConfirmModal
                    show={showDeleteDocConfirm}
                    onConfirm={handleDeleteAttachment}
                    onClose={() => { setShowDeleteDocConfirm(false); setUrlToConfirmDelete(null); }}
                />
            )}

            {/* PDF Import Preview Modal */}
            {portalReady && (
                <ImportPreviewModal
                    show={showImportPreviewModal}
                    importPreviewData={importPreviewData}
                    importRecordEstados={importRecordEstados}
                    importRecordComunidades={importRecordComunidades}
                    importReceptorName={importReceptorName}
                    comunidades={comunidades}
                    onClose={closeImportModal}
                    onConfirm={handleConfirmImport}
                    setImportRecordEstados={setImportRecordEstados}
                    setImportRecordComunidades={setImportRecordComunidades}
                />
            )}

            {/* Aplazar Modal */}
            {portalReady && (
                <AplazarModal
                    show={showAplazarModal}
                    aplazarDate={aplazarDate}
                    onDateChange={setAplazarDate}
                    onConfirm={aplazarTicket}
                    onClose={() => { setShowAplazarModal(false); setAplazarIncidenciaId(null); setAplazarDate(''); }}
                />
            )}

            {/* Global Blocking Loader */}
            {portalReady && importingPdf && createPortal(
                <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-neutral-900/80 backdrop-blur-md">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-[#bf4b50]/20 rounded-full" />
                        <div className="absolute inset-0 border-4 border-[#bf4b50] border-t-transparent rounded-full animate-spin" />
                        <FileText className="absolute inset-0 m-auto w-10 h-10 text-[#bf4b50] animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">Procesando PDF</h3>
                        <p className="text-neutral-400 text-sm max-w-xs px-6">Analizando y extrayendo los registros del informe. Por favor, no cierres esta ventana.</p>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}
