'use client';

import { useState, useEffect } from 'react';
import { useGlobalLoading } from '@/lib/globalLoading';
import { createPortal } from 'react-dom';
import { Plus, Mail, Building, FileText, Loader2, Download, ExternalLink, CheckCircle2, AlertCircle, Trash2, ChevronUp, ChevronDown, Filter, CreditCard, TicketCheck, Eye, Clock, X, BarChart2, ChevronRight } from 'lucide-react';
import SelectFilter from '@/components/SelectFilter';
import DataTable, { Column, RowAction } from '@/components/DataTable';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';

interface Folder {
    name?: string;
    displayName?: string;
    id: string;
}

interface HistoricalReport {
    id: string;
    community_id: string;
    community_name: string;
    title: string;
    period_start: string;
    period_end: string;
    pdf_path: string;
    created_at: string;
}

export default function InformesComunidadPage() {
    const { withLoading } = useGlobalLoading();
    // State for folders (generator)
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>('');
    const [fechaInicio, setFechaInicio] = useState<string>('');
    const [fechaFin, setFechaFin] = useState<string>('');

    // Section selections
    const [includeEmails, setIncludeEmails] = useState(true);
    const [includeDebts, setIncludeDebts] = useState(true);
    const [includeTickets, setIncludeTickets] = useState(true);
    const [includeCronometraje, setIncludeCronometraje] = useState(true);

    // Filters per section
    const [ticketFilter, setTicketFilter] = useState<'all' | 'pending'>('all');
    const [debtFilter, setDebtFilter] = useState<'all' | 'pending'>('all');
    const [includeCharts, setIncludeCharts] = useState(true);

    // History State
    const [historicalReports, setHistoricalReports] = useState<HistoricalReport[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [filterCommunity, setFilterCommunity] = useState<string>('all');

    // UI State
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);

    // Deletion
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [reportToDelete, setReportToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const [successModal, setSuccessModal] = useState<{
        open: boolean;
        pdfUrl: string;
        community: string;
    }>({ open: false, pdfUrl: '', community: '' });

    const [portalReady, setPortalReady] = useState(false);
    useEffect(() => setPortalReady(true), []);

    useEffect(() => {
        fetchHistory();

        // Set default dates
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        setFechaFin(end.toISOString().split('T')[0]);
        setFechaInicio(start.toISOString().split('T')[0]);
    }, []);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('email_reports')
                .select('*')
                .ilike('title', 'Informe Global%')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistoricalReports(data || []);
        } catch (error) {
            console.error(error);
            setHistoricalReports([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchFolders = async () => {
        setShowGenerator(true);
        setLoadingFolders(true);
        try {
            const response = await fetch('/api/onedrive/folders');
            if (!response.ok) throw new Error('Error al cargar comunidades');
            const data = await response.json();
            setFolders(data || []);
        } catch (error) {
            console.error(error);
            toast.error('No se pudieron cargar las carpetas de Outlook');
        } finally {
            setLoadingFolders(false);
        }
    };

    const handleGenerateReport = async () => {
        const errors: Record<string, string> = {};
        if (!selectedFolder || !fechaInicio || !fechaFin) errors.config = 'Debes completar comunidad y fechas';
        const hasSection = includeEmails || includeDebts || includeTickets || includeCronometraje;
        if (!hasSection) errors.sections = 'Debes seleccionar al menos una sección';
        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
        setFormErrors({});

        await withLoading(async () => {
        setIsGenerating(true);
        try {
            const folder = folders.find(f => f.id === selectedFolder);
            const communityName = folder?.displayName || folder?.name || 'Comunidad';

            // Call the combined report API
            const response = await fetch('/api/dashboard/community-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    communityId: selectedFolder,
                    communityName: communityName,
                    communityCode: selectedFolder,
                    includeEmails,
                    includeDebts,
                    includeTickets,
                    includeCronometraje,
                    ticketFilter,
                    debtFilter,
                    includeCharts,
                    startDate: fechaInicio,
                    endDate: fechaFin,
                    saveToHistory: true
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Error al generar el informe');
            }

            const data = await response.json();

            setSuccessModal({
                open: true,
                pdfUrl: data.pdfUrl,
                community: communityName
            });

            // Refresh history
            fetchHistory();
            setShowGenerator(false);

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Error en el proceso');
        } finally {
            setIsGenerating(false);
        }
        }, 'Generando informe de comunidad...');
    };

    const handleViewPdf = async (path: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('documentos')
                .createSignedUrl(path, 3600);
            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (error) {
            toast.error('No se pudo abrir el PDF');
        }
    };

    const handleDownloadPdf = async (path: string, fileName: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('documentos')
                .createSignedUrl(path, 3600);
            if (error) throw error;
            const res = await fetch(data.signedUrl);
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            toast.error('No se pudo descargar el PDF');
        }
    };

    const handleDeleteReport = (id: string) => {
        setReportToDelete(id);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async ({ email, password }: any) => {
        if (!reportToDelete) return;
        await withLoading(async () => {
            setIsDeleting(true);
            try {
                const response = await fetch('/api/reports/email/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: reportToDelete, email, password })
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Error al eliminar');
                }
                toast.success('Informe eliminado');
                setShowDeleteModal(false);
                setReportToDelete(null);
                fetchHistory();
            } catch (error: any) {
                toast.error(error.message);
            } finally {
                setIsDeleting(false);
            }
        }, 'Eliminando informe...');
    };

    const communitiesList = Array.from(new Set(historicalReports.map(r => r.community_name))).sort();
    const filteredReports = historicalReports.filter(r => filterCommunity === 'all' || r.community_name === filterCommunity);

    return (
        <div className="space-y-6 md:space-y-8 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold text-neutral-900">Informes de Comunidad</h1>
                </div>
                <button
                    onClick={fetchFolders}
                    disabled={loadingFolders || isGenerating}
                    className="bg-[#bf4b50] text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-[#a03d42] transition flex items-center gap-2 disabled:opacity-50"
                >
                    {loadingFolders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Nuevo Informe Global
                </button>
            </div>

            {/* History Table */}
            <DataTable<HistoricalReport>
                data={filteredReports}
                loading={loadingHistory}
                keyExtractor={(r) => r.id}
                storageKey="informes-comunidad"
                emptyMessage="No hay informes globales generados aún."
                extraFilters={
                    <SelectFilter
                        value={filterCommunity}
                        onChange={setFilterCommunity}
                        options={[
                            { value: 'all', label: 'Todas las comunidades' },
                            ...communitiesList.map(c => ({ value: c, label: c })),
                        ]}
                    />
                }
                columns={[
                    {
                        key: 'created_at',
                        label: 'Fecha',
                        render: (r) => (
                            <div className="flex flex-col">
                                <span className="font-medium text-neutral-900">{new Date(r.created_at).toLocaleDateString()}</span>
                                <span className="text-[10px] text-neutral-400">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        ),
                        getSearchValue: (r) => new Date(r.created_at).toLocaleDateString(),
                    },
                    {
                        key: 'community_name',
                        label: 'Comunidad',
                        render: (r) => (
                            <div className="flex items-center gap-2">
                                <Building className="w-4 h-4 text-[#a03d42] shrink-0" />
                                <span>{r.community_name}</span>
                            </div>
                        ),
                    },
                    {
                        key: 'period_start',
                        label: 'Periodo',
                        render: (r) => (
                            <span className="text-neutral-500">
                                {new Date(r.period_start).toLocaleDateString()} — {new Date(r.period_end).toLocaleDateString()}
                            </span>
                        ),
                        getSearchValue: (r) => `${new Date(r.period_start).toLocaleDateString()} ${new Date(r.period_end).toLocaleDateString()}`,
                    },
                    {
                        key: 'title',
                        label: 'Contenido',
                        render: (r) => <span className="text-neutral-600">{r.title.replace('Informe Global: ', '')}</span>,
                    },
                ] as Column<HistoricalReport>[]}
                rowActions={(r) => [
                    {
                        label: 'Ver PDF',
                        icon: <Eye className="w-3.5 h-3.5" />,
                        onClick: (row) => handleViewPdf(row.pdf_path),
                    },
                    {
                        label: 'Descargar',
                        icon: <Download className="w-3.5 h-3.5" />,
                        onClick: (row) => handleDownloadPdf(row.pdf_path, row.title),
                        variant: 'success',
                    },
                    {
                        label: 'Eliminar',
                        icon: <Trash2 className="w-3.5 h-3.5" />,
                        onClick: (row) => handleDeleteReport(row.id),
                        variant: 'danger',
                        separator: true,
                    },
                ]}
            />

            {/* Generator Modal */}
            {portalReady && showGenerator && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4">
                    <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" onClick={() => { setShowGenerator(false); setFormErrors({}); }} />
                    <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92dvh] sm:max-h-[90dvh] overflow-hidden">
                        {/* Header fijo */}
                        <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50 shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                                    Nuevo Informe de Comunidad
                                </h2>
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">Complete los datos del informe</p>
                            </div>
                            <button onClick={() => { setShowGenerator(false); setFormErrors({}); }} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Body scrollable */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5">

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-neutral-700">Comunidad (Carpeta de Outlook)</label>
                                <SelectFilter
                                    value={selectedFolder}
                                    onChange={v => { setSelectedFolder(v); setFormErrors(prev => ({ ...prev, config: '' })); }}
                                    disabled={loadingFolders}
                                    error={!!formErrors.config}
                                    size="md"
                                    className="w-full"
                                    placeholder={loadingFolders ? 'Cargando comunidades...' : 'Selecciona una comunidad...'}
                                    options={folders.map(f => ({ value: f.id, label: f.displayName || f.name || f.id }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-neutral-700">Desde</label>
                                    <input type="date" value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); setFormErrors(prev => ({ ...prev, config: '' })); }} className={`w-full bg-neutral-50 border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#bf4b50] ${formErrors.config ? 'border-red-400' : 'border-neutral-200'}`} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-neutral-700">Hasta</label>
                                    <input type="date" value={fechaFin} onChange={(e) => { setFechaFin(e.target.value); setFormErrors(prev => ({ ...prev, config: '' })); }} className={`w-full bg-neutral-50 border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#bf4b50] ${formErrors.config ? 'border-red-400' : 'border-neutral-200'}`} />
                                </div>
                            </div>
                            {formErrors.config && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500 col-span-full"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.config}</p>}
                        </div>

                        {/* Secciones */}
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-neutral-700">Contenido del informe</p>

                            {/* Tickets */}
                            <div className={`rounded-xl border-2 transition-all ${includeTickets ? 'border-[#bf4b50] bg-yellow-50' : formErrors.sections ? 'border-red-300' : 'border-neutral-100 bg-neutral-50'}`}>
                                <label className="flex items-center gap-3 p-4 cursor-pointer">
                                    <input type="checkbox" checked={includeTickets} onChange={e => { setIncludeTickets(e.target.checked); setFormErrors(prev => ({ ...prev, sections: '' })); }} className="w-4 h-4 accent-[#a03d42]" />
                                    <TicketCheck className={`w-5 h-5 ${includeTickets ? 'text-yellow-600' : 'text-neutral-400'}`} />
                                    <span className="text-sm font-semibold text-neutral-800">Tickets / Incidencias</span>
                                </label>
                                {includeTickets && (
                                    <div className="px-4 pb-4 flex gap-3 flex-wrap">
                                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${ticketFilter === 'all' ? 'border-[#bf4b50] bg-yellow-100 text-yellow-800' : 'border-neutral-200 text-neutral-500'}`}>
                                            <input type="radio" name="ticketFilter" value="all" checked={ticketFilter === 'all'} onChange={() => setTicketFilter('all')} className="sr-only" />
                                            Todos los tickets
                                        </label>
                                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${ticketFilter === 'pending' ? 'border-[#bf4b50] bg-yellow-100 text-yellow-800' : 'border-neutral-200 text-neutral-500'}`}>
                                            <input type="radio" name="ticketFilter" value="pending" checked={ticketFilter === 'pending'} onChange={() => setTicketFilter('pending')} className="sr-only" />
                                            Solo pendientes
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Deudas */}
                            <div className={`rounded-xl border-2 transition-all ${includeDebts ? 'border-[#bf4b50] bg-yellow-50' : formErrors.sections ? 'border-red-300' : 'border-neutral-100 bg-neutral-50'}`}>
                                <label className="flex items-center gap-3 p-4 cursor-pointer">
                                    <input type="checkbox" checked={includeDebts} onChange={e => { setIncludeDebts(e.target.checked); setFormErrors(prev => ({ ...prev, sections: '' })); }} className="w-4 h-4 accent-[#a03d42]" />
                                    <CreditCard className={`w-5 h-5 ${includeDebts ? 'text-yellow-600' : 'text-neutral-400'}`} />
                                    <span className="text-sm font-semibold text-neutral-800">Deudas / Morosidad</span>
                                </label>
                                {includeDebts && (
                                    <div className="px-4 pb-4 flex gap-3 flex-wrap">
                                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${debtFilter === 'all' ? 'border-[#bf4b50] bg-yellow-100 text-yellow-800' : 'border-neutral-200 text-neutral-500'}`}>
                                            <input type="radio" name="debtFilter" value="all" checked={debtFilter === 'all'} onChange={() => setDebtFilter('all')} className="sr-only" />
                                            Todas las deudas
                                        </label>
                                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${debtFilter === 'pending' ? 'border-[#bf4b50] bg-yellow-100 text-yellow-800' : 'border-neutral-200 text-neutral-500'}`}>
                                            <input type="radio" name="debtFilter" value="pending" checked={debtFilter === 'pending'} onChange={() => setDebtFilter('pending')} className="sr-only" />
                                            Solo pendientes
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Emails */}
                            <div className={`rounded-xl border-2 transition-all ${includeEmails ? 'border-[#bf4b50] bg-yellow-50' : formErrors.sections ? 'border-red-300' : 'border-neutral-100 bg-neutral-50'}`}>
                                <label className="flex items-center gap-3 p-4 cursor-pointer">
                                    <input type="checkbox" checked={includeEmails} onChange={e => { setIncludeEmails(e.target.checked); setFormErrors(prev => ({ ...prev, sections: '' })); }} className="w-4 h-4 accent-[#a03d42]" />
                                    <Mail className={`w-5 h-5 ${includeEmails ? 'text-yellow-600' : 'text-neutral-400'}`} />
                                    <span className="text-sm font-semibold text-neutral-800">Emails</span>
                                </label>
                            </div>

                            {/* Cronometraje */}
                            <div className={`rounded-xl border-2 transition-all ${includeCronometraje ? 'border-[#bf4b50] bg-yellow-50' : formErrors.sections ? 'border-red-300' : 'border-neutral-100 bg-neutral-50'}`}>
                                <label className="flex items-center gap-3 p-4 cursor-pointer">
                                    <input type="checkbox" checked={includeCronometraje} onChange={e => { setIncludeCronometraje(e.target.checked); setFormErrors(prev => ({ ...prev, sections: '' })); }} className="w-4 h-4 accent-[#a03d42]" />
                                    <Clock className={`w-5 h-5 ${includeCronometraje ? 'text-yellow-600' : 'text-neutral-400'}`} />
                                    <span className="text-sm font-semibold text-neutral-800">Cronometraje</span>
                                </label>
                            </div>

                            {formErrors.sections && <p className="flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.sections}</p>}
                        </div>

                        {/* Opciones adicionales */}
                        <div className="border-t border-neutral-100 pt-5 space-y-3">
                            <p className="text-sm font-semibold text-neutral-700">Opciones adicionales</p>
                            <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${includeCharts ? 'border-[#bf4b50] bg-yellow-50' : 'border-neutral-100 bg-neutral-50'}`}>
                                <input type="checkbox" checked={includeCharts} onChange={e => setIncludeCharts(e.target.checked)} className="w-4 h-4 accent-[#a03d42]" />
                                <BarChart2 className={`w-5 h-5 ${includeCharts ? 'text-yellow-600' : 'text-neutral-400'}`} />
                                <div>
                                    <p className="text-sm font-semibold text-neutral-800">Incluir gráficos visuales</p>
                                    <p className="text-xs text-neutral-500">Gráficos de estado, urgencia y distribución en cada sección</p>
                                </div>
                            </label>
                        </div>

                        <button
                            onClick={handleGenerateReport}
                            disabled={isGenerating || !selectedFolder}
                            className="w-full bg-neutral-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-neutral-800 transition shadow-lg disabled:opacity-50"
                        >
                            {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generando Informe Global...</> : <><CheckCircle2 className="w-5 h-5 text-[#bf4b50]" /> Generar Informe Combinado</>}
                        </button>
                        </div>{/* /body scrollable */}
                    </div>
                </div>
            , document.body)}

            {/* Deletion Modal */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setReportToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                itemType="informe"
                isDeleting={isDeleting}
                description="Se eliminará permanentemente tanto el registro histórico como el archivo PDF del servidor."
            />

            {/* Success Modal — portal so it covers navbar */}
            {portalReady && successModal.open && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-neutral-900/70 backdrop-blur-sm" onClick={() => setSuccessModal({ ...successModal, open: false })} />
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-neutral-900">¡Informe Global Generado!</h3>
                            <p className="text-neutral-500 mt-2">El informe de <strong>{successModal.community}</strong> ha sido generado correctamente.</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button onClick={async () => {
                                try {
                                    const res = await fetch(successModal.pdfUrl);
                                    const blob = await res.blob();
                                    const blobUrl = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = blobUrl;
                                    a.download = `Informe_Global_${successModal.community}.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(blobUrl);
                                    document.body.removeChild(a);
                                } catch {
                                    toast.error('No se pudo descargar el PDF');
                                }
                            }} className="bg-neutral-900 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition">
                                <Download className="w-4 h-4" /> Descargar PDF
                            </button>
                            <button onClick={() => setSuccessModal({ ...successModal, open: false })} className="text-neutral-400 text-sm font-medium hover:text-neutral-600 mt-2">Cerrar</button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Global Blocking Loader — portal so it covers navbar */}
            {portalReady && isGenerating && createPortal(
                <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-neutral-900/80 backdrop-blur-md">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-[#bf4b50]/20 rounded-full" />
                        <div className="absolute inset-0 border-4 border-[#bf4b50] border-t-transparent rounded-full animate-spin" />
                        <Building className="absolute inset-0 m-auto w-10 h-10 text-[#bf4b50] animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">Generando Informe de Comunidad</h3>
                        <p className="text-neutral-400 text-sm max-w-xs px-6">
                            Estamos recopilando datos y generando tu PDF certificado.
                            {includeEmails && " Procesando emails con IA..."}
                            {" "}Por favor, no cierres esta ventana.
                        </p>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}
