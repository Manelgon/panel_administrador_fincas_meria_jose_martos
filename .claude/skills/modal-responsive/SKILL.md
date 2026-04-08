---
name: modal-responsive
description: "Convierte cualquier modal al patron bottom-sheet responsive del proyecto: ModalPortal para escapar el stacking context del navbar, overlay fixed con z-[9999], animacion slide-from-bottom en movil y zoom-in en desktop, max-h con dvh. Activar cuando hay problemas de modal cortado, z-index, o al crear un modal nuevo."
---

# Modal Responsive — Patron del Proyecto

> Cada modal en este proyecto sigue el mismo patron. Esta skill lo aplica de forma consistente.

---

## Cuando Activar

- "el modal se corta en movil"
- "el modal no tapa el navbar"
- "crea un modal para X"
- "el dropdown/confirmacion aparece por detras de algo"
- cualquier modal nuevo que haya que construir

---

## El Patron Obligatorio

### 1. Siempre usar `ModalPortal`

```tsx
import ModalPortal from '@/components/ModalPortal';
```

**Por que:** El navbar y el sidebar tienen `backdropFilter` o `z-index` que crean un nuevo stacking context. Sin ModalPortal, el modal queda atrapado debajo aunque tenga `z-[9999]`. ModalPortal usa `createPortal(children, document.body)` para escapar completamente.

### 2. Estructura del overlay

```tsx
<ModalPortal>
  {isOpen && (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">Titulo del Modal</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY — scrolleable */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* contenido */}
        </div>

        {/* FOOTER — fijo abajo */}
        <div className="p-4 border-t shrink-0 flex gap-2 justify-end">
          <button onClick={onClose}>Cancelar</button>
          <button onClick={onConfirm}>Confirmar</button>
        </div>
      </div>
    </div>
  )}
</ModalPortal>
```

### 3. Reglas criticas

| Regla | Por que |
|-------|---------|
| `fixed inset-0` en el overlay | Cubre toda la pantalla |
| `z-[9999]` en el overlay | Por encima del navbar (z-50) y sidebar |
| `items-end` en movil, `items-center` en desktop | Bottom-sheet en movil |
| `rounded-t-2xl sm:rounded-xl` | Sin bordes inferiores en movil |
| `max-h-[92dvh]` | `dvh` en lugar de `vh` — evita que el teclado virtual lo corte |
| `overflow-hidden` en el contenedor | Para que el scroll interno funcione |
| `flex-1 overflow-y-auto` en el body | Solo el body hace scroll, header y footer fijos |
| `shrink-0` en header y footer | Que no se encojan cuando el body crece |
| `e.stopPropagation()` en el modal | Evitar que el click en el modal cierre el overlay |

### 4. Modales de confirmacion

Para confirmaciones destructivas (borrar, eliminar), usar `z-[99999]` (un nivel mas) y portal separado:

```tsx
{showConfirm && (
  <ModalPortal>
    <div className="fixed inset-0 bg-black/70 z-[99999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
        <h3 className="font-semibold text-lg mb-2">¿Confirmar accion?</h3>
        <p className="text-gray-600 text-sm mb-4">Esta accion no se puede deshacer.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setShowConfirm(false)} className="px-4 py-2 rounded-lg border">Cancelar</button>
          <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 text-white">Eliminar</button>
        </div>
      </div>
    </div>
  </ModalPortal>
)}
```

---

## Flujo de Aplicacion

```
1. IDENTIFICAR el modal a crear/corregir
2. LEER el archivo actual si existe
3. ENVOLVER con <ModalPortal>
4. APLICAR clases del patron (overlay + contenedor)
5. SEPARAR header/body/footer con flex-col
6. VERIFICAR que no usa vh (cambiar por dvh)
7. VERIFICAR que no tiene z-index hardcodeado menor a 9999
```

## Checklist antes de entregar

- [ ] `import ModalPortal from '@/components/ModalPortal'`
- [ ] Overlay con `fixed inset-0 z-[9999]`
- [ ] `items-end sm:items-center` en el overlay
- [ ] `rounded-t-2xl sm:rounded-xl` en el contenedor
- [ ] `max-h-[92dvh]` (dvh, no vh)
- [ ] Header con `shrink-0`, body con `flex-1 overflow-y-auto`, footer con `shrink-0`
- [ ] `stopPropagation` en el contenedor del modal
