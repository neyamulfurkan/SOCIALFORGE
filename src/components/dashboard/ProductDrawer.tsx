'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';

// ─── Forward dependencies (not yet generated) ────────────────────────────────
// uiStore (FILE 080): accessed via dynamic require with typed fallback
// Drawer (FILE 074): stub defined inline — replace with real import once FILE 074 is generated
// Badge (FILE 075): not used in this component directly (status shown via select)
// ─────────────────────────────────────────────────────────────────────────────

import { useUIStore } from '@/store/uiStore';
import Button from '@/components/ui/Button';
import Input, { Textarea } from '@/components/ui/Input';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ProductWithVariants } from '@/lib/types';

// ─────────────────────────────────────────────
// uiStore dynamic access (FILE 080 not yet generated)
// When FILE 080 is generated, replace with:
//   import { useUIStore } from '@/store/uiStore'
// ─────────────────────────────────────────────

function useProductDrawerState() {
  const drawerOpen = useUIStore((s) => s.drawerOpen);
  const drawerType = useUIStore((s) => s.drawerType);
  const drawerId = useUIStore((s) => s.drawerId);
  const closeDrawer = useUIStore((s) => s.closeDrawer);
  return { drawerOpen, drawerType, drawerId, closeDrawer };
}

import Drawer from '@/components/ui/Drawer';

// ─────────────────────────────────────────────
// Toast accessor (FILE 073 not yet generated in required list,
// but products page already imports it so it must exist by the
// time ProductDrawer is used — dynamic fallback just in case)
// ─────────────────────────────────────────────

import { toast } from '@/components/ui/Toast';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type VariantRow = {
  name: string;
  options: string; // comma-separated
};

type FormState = {
  name: string;
  description: string;
  price: string;
  compareAtPrice: string;
  category: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  trackStock: boolean;
  stockQuantity: string;
  images: string[]; // Cloudinary secure_url values
  variants: VariantRow[];
};

type UploadedImage = {
  url: string;
  uploading?: boolean;
  error?: boolean;
  progress?: number;
};

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  price: '',
  compareAtPrice: '',
  category: '',
  status: 'DRAFT',
  trackStock: false,
  stockQuantity: '0',
  images: [],
  variants: [],
};

// ─────────────────────────────────────────────
// Cloudinary upload helper
// ─────────────────────────────────────────────

type UploadSignature = {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
  folder: string;
};

async function fetchUploadSignature(): Promise<UploadSignature> {
  const res = await fetch('/api/uploads', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to get upload signature');
  const json = await res.json() as { data?: UploadSignature } & UploadSignature;
  // unwrap { data: ... } wrapper from the API route
  return json.data ?? json;
}

async function uploadToCloudinary(
  file: File,
  sig: UploadSignature,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', sig.apiKey);
    fd.append('timestamp', String(sig.timestamp));
    fd.append('signature', sig.signature);
    fd.append('folder', sig.folder);
    // upload_preset is NOT included when using signed uploads —
    // signed uploads use api_key + signature instead

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { secure_url: string };
        resolve(data.secure_url);
      } else {
        console.error('Cloudinary error response:', xhr.responseText);
        reject(new Error('Upload failed: ' + xhr.responseText));
      }
    };

    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(fd);
  });
}

// ─────────────────────────────────────────────
// Image upload zone sub-component
// ─────────────────────────────────────────────

type ImageUploadZoneProps = {
  images: UploadedImage[];
  onAddImages: (files: File[]) => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
};

function ImageUploadZone({ images, onAddImages, onRemove, onReorder }: ImageUploadZoneProps) {
  const [draggingOver, setDraggingOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDraggingOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      );
      if (files.length > 0) onAddImages(files);
    },
    [onAddImages],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onAddImages(files);
    // Reset so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  // Thumbnail drag-to-reorder (simple index swap)
  const handleThumbDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleThumbDrop = (e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (dragIndexRef.current !== null && dragIndexRef.current !== toIndex) {
      onReorder(dragIndexRef.current, toIndex);
    }
    dragIndexRef.current = null;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDraggingOver(true);
        }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          draggingOver
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-accent/50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <svg
          className="mx-auto mb-2 text-text-tertiary"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-sm text-text-secondary">
          Drop images here or{' '}
          <span className="text-accent font-medium">browse</span>
        </p>
        <p className="text-xs text-text-tertiary mt-1">PNG, JPG, WEBP up to 10MB each</p>
      </div>

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => handleThumbDragStart(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleThumbDrop(e, index)}
              className="relative w-20 h-20 rounded-md overflow-hidden border border-border bg-surface-raised cursor-grab active:cursor-grabbing shrink-0"
            >
              {img.uploading ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <svg
                    className="animate-spin text-accent"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  {img.progress !== undefined && (
                    <span className="text-[10px] text-text-tertiary">{img.progress}%</span>
                  )}
                </div>
              ) : img.error ? (
                <div className="w-full h-full flex items-center justify-center bg-error/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-error">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
              ) : (
                img.url.includes('res.cloudinary.com') ? (
                <Image
                  src={img.url}
                  alt={`Product image ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
                ) : (
                <img
                  src={img.url}
                  alt={`Product image ${index + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                )
              )}

              {/* Remove button */}
              {!img.uploading && (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-black/80 transition-colors"
                  aria-label="Remove image"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Primary badge */}
              {index === 0 && !img.uploading && !img.error && (
                <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[9px] px-1 rounded">
                  Main
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Variant builder sub-component
// ─────────────────────────────────────────────

type VariantBuilderProps = {
  variants: VariantRow[];
  onChange: (variants: VariantRow[]) => void;
};

function VariantBuilder({ variants, onChange }: VariantBuilderProps) {
  const addVariant = () => {
    onChange([...variants, { name: '', options: '' }]);
  };

  const updateVariant = (index: number, field: keyof VariantRow, value: string) => {
    const updated = variants.map((v, i) =>
      i === index ? { ...v, [field]: value } : v,
    );
    onChange(updated);
  };

  const removeVariant = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      {variants.map((v, index) => (
        <div key={index} className="flex gap-2 items-start">
          <div className="flex-1">
            <Input
              placeholder="Variant name (e.g. Size)"
              value={v.name}
              onChange={(e) => updateVariant(index, 'name', e.target.value)}
            />
          </div>
          <div className="flex-[2]">
            <Input
              placeholder="Options, comma-separated (e.g. S, M, L)"
              value={v.options}
              onChange={(e) => updateVariant(index, 'options', e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => removeVariant(index)}
            className="mt-2 text-text-tertiary hover:text-error transition-colors p-1"
            aria-label="Remove variant"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addVariant}
        className={cn(
          'flex items-center gap-2 text-sm text-accent hover:text-accent-hover',
          'transition-colors self-start',
        )}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add Variant
      </button>

      {variants.length > 0 && (
        <p className="text-xs text-text-tertiary">
          Tip: Use commas to separate options, e.g. "Red, Blue, Green"
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section header helper
// ─────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

// ─────────────────────────────────────────────
// Main ProductDrawer component
// ─────────────────────────────────────────────

export default function ProductDrawer({ businessId }: { businessId: string }) {
  const { drawerOpen, drawerType, drawerId, closeDrawer } = useProductDrawerState();

  const isOpen = drawerOpen && drawerType === 'product';
  const isEditMode = !!drawerId;

  const queryClient = useQueryClient();

  // ── Form state ──
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // AI description suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // ── Fetch product data in edit mode ──
  const { data: editProduct, isLoading: editLoading } = useQuery({
    queryKey: ['product-edit', drawerId],
    queryFn: async (): Promise<ProductWithVariants> => {
      const res = await fetch(`/api/products/${drawerId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch product');
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: isOpen && isEditMode,
    staleTime: 0,
  });

  // ── Populate form when product loads ──
  useEffect(() => {
    if (!isOpen) return;

    if (isEditMode && editProduct) {
      setForm({
        name: editProduct.name,
        description: editProduct.description ?? '',
        price: String(editProduct.price),
        compareAtPrice: editProduct.compareAtPrice ? String(editProduct.compareAtPrice) : '',
        category: editProduct.category,
        status: editProduct.status as FormState['status'],
        trackStock: editProduct.trackStock,
        stockQuantity: String(editProduct.stockQuantity),
        images: editProduct.images,
        variants: editProduct.variants.map((v) => ({
          name: v.name,
          options: Array.isArray(v.options)
            ? (v.options as string[]).join(', ')
            : '',
        })),
      });
      setUploadedImages(editProduct.images.map((url) => ({ url })));
      setIsDirty(false);
      setAiSuggestion(null);
    } else if (!isEditMode) {
      setForm(EMPTY_FORM);
      setUploadedImages([]);
      setIsDirty(false);
      setAiSuggestion(null);
      setErrors({});
    }
  }, [isOpen, isEditMode, editProduct]);

  // ── Sync uploadedImages urls → form.images ──
  useEffect(() => {
    const urls = uploadedImages
      .filter((img) => !img.uploading && !img.error && img.url)
      .map((img) => img.url);
    setForm((prev) => {
      if (JSON.stringify(prev.images) === JSON.stringify(urls)) return prev;
      return { ...prev, images: urls };
    });
  }, [uploadedImages]);

  // ── Field change helper ──
  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setIsDirty(true);
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    [],
  );

  // ── AI description suggestion on name blur ──
  const handleNameBlur = useCallback(async () => {
    if (form.name.length <= 3 || !form.category) return;
    if (form.description && !aiSuggestion) return; // don't overwrite existing
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productName: form.name,
          category: form.category,
          businessId,
        }),
      });
      if (res.ok) {
        const json = await res.json() as { description?: string };
        if (json.description) setAiSuggestion(json.description);
      }
    } catch {
      // Silently fail — description suggestion is non-critical
    } finally {
      setAiLoading(false);
    }
  }, [form.name, form.category, form.description, aiSuggestion, businessId]);

  // ── Image upload handler ──
  const handleAddImages = useCallback(async (files: File[]) => {
    // Create placeholder entries
    const placeholders: UploadedImage[] = files.map(() => ({
      url: '',
      uploading: true,
      progress: 0,
    }));
    setUploadedImages((prev) => [...prev, ...placeholders]);
    const startIndex = uploadedImages.length;

    // Fetch one signature (reuse for all uploads in this batch)
    let sig: UploadSignature;
    try {
      sig = await fetchUploadSignature();
    } catch {
      // Mark all as error
      setUploadedImages((prev) =>
        prev.map((img, i) =>
          i >= startIndex ? { url: '', error: true } : img,
        ),
      );
      toast.error('Failed to get upload credentials');
      return;
    }

    // Upload each file
    await Promise.all(
      files.map(async (file, offset) => {
        const idx = startIndex + offset;
        try {
          const url = await uploadToCloudinary(file, sig, (pct) => {
            setUploadedImages((prev) =>
              prev.map((img, i) => (i === idx ? { ...img, progress: pct } : img)),
            );
          });
          setUploadedImages((prev) =>
            prev.map((img, i) => (i === idx ? { url, uploading: false } : img)),
          );
          setIsDirty(true);
        } catch {
          setUploadedImages((prev) =>
            prev.map((img, i) =>
              i === idx ? { url: '', error: true, uploading: false } : img,
            ),
          );
        }
      }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedImages.length]);

  const handleRemoveImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const handleReorderImages = (from: number, to: number) => {
    setUploadedImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setIsDirty(true);
  };

  // ── Validate ──
  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0)
      newErrors.price = 'Enter a valid price';
    if (!form.category) newErrors.category = 'Category is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Create mutation ──
  const createMutation = useMutation({
    mutationFn: async (payload: object) => {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? 'Failed to create product');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', businessId] });
      toast.success('Product created');
      closeDrawer();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ── Update mutation ──
  const updateMutation = useMutation({
    mutationFn: async (payload: object) => {
      const res = await fetch(`/api/products/${drawerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? 'Failed to update product');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', businessId] });
      queryClient.invalidateQueries({ queryKey: ['product-edit', drawerId] });
      toast.success('Product saved');
      closeDrawer();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ── Save handler ──
  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
      category: form.category,
      status: form.status,
      trackStock: form.trackStock,
      stockQuantity: Number(form.stockQuantity),
      images: form.images,
      variants: form.variants
        .filter((v) => v.name.trim())
        .map((v) => ({
          name: v.name.trim(),
          options: v.options
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        })),
    };

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ── Unsaved changes guard ──
  const handleClose = useCallback(() => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Discard them?')) {
        setIsDirty(false);
        closeDrawer();
      }
    } else {
      closeDrawer();
    }
  }, [isDirty, closeDrawer]);

  // ── Render ──
  const isLoading = isEditMode && editLoading;
  const title = isEditMode ? 'Edit Product' : 'Add Product';

  return (
    <Drawer
      open={isOpen}
      onClose={handleClose}
      title={title}
      width={640}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isSaving}
            disabled={isLoading}
          >
            {isEditMode ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-surface-raised rounded-md" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* ── Images ── */}
          <div>
            <SectionHeader>Images</SectionHeader>
            <ImageUploadZone
              images={uploadedImages}
              onAddImages={handleAddImages}
              onRemove={handleRemoveImage}
              onReorder={handleReorderImages}
            />
          </div>

          {/* ── Basic Info ── */}
          <div className="flex flex-col gap-4">
            <SectionHeader>Basic Information</SectionHeader>

            <Input
              label="Product Name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              onBlur={handleNameBlur}
              error={errors.name}
              placeholder="e.g. Summer Floral Dress"
            />

            {/* Description with AI suggestion */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">
                Description
              </label>

              {/* AI suggestion banner */}
              {aiSuggestion && (
                <div className="bg-accent/8 border border-accent/20 rounded-md p-3 mb-1 relative">
                  <p className="text-xs font-medium text-accent mb-1">✦ AI Suggested</p>
                  <p className="text-sm text-text-secondary leading-relaxed">{aiSuggestion}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setField('description', aiSuggestion);
                        setAiSuggestion(null);
                      }}
                      className="text-xs bg-accent text-accent-text px-2.5 py-1 rounded font-medium hover:bg-accent-hover transition-colors"
                    >
                      ✓ Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiSuggestion(null)}
                      className="text-xs text-text-secondary hover:text-text-primary transition-colors px-2 py-1"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              <div className="relative">
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Describe your product…"
                />
                {/* Loading spinner overlay when AI is generating */}
                {aiLoading && (
                  <div className="absolute inset-0 bg-surface/60 rounded-md flex items-center justify-center">
                    <div className="flex items-center gap-2 text-text-secondary text-sm">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Generating AI description…
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Price (৳)"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setField('price', e.target.value)}
                error={errors.price}
                placeholder="0.00"
              />
              <Input
                label="Compare-at Price (৳)"
                type="number"
                min="0"
                step="0.01"
                value={form.compareAtPrice}
                onChange={(e) => setField('compareAtPrice', e.target.value)}
                placeholder="Optional"
                hint="Shown as strikethrough"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">Category</label>
              <select
                value={form.category}
                onChange={(e) => {
                  setField('category', e.target.value);
                  setIsDirty(true);
                }}
                className={cn(
                  'w-full bg-surface border border-border rounded-md px-3 py-2',
                  'text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors',
                  errors.category && 'border-error focus:border-error focus:ring-error/20',
                )}
              >
                <option value="">Select a category</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-sm text-error">{errors.category}</p>
              )}
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">Status</label>
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value as FormState['status'])}
                className={cn(
                  'w-full bg-surface border border-border rounded-md px-3 py-2',
                  'text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors',
                )}
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <p className="text-xs text-text-tertiary">
                Only Active products appear on your public store.
              </p>
            </div>
          </div>

          {/* ── Inventory ── */}
          <div className="flex flex-col gap-4">
            <SectionHeader>Inventory</SectionHeader>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.trackStock}
                  onChange={(e) => setField('trackStock', e.target.checked)}
                />
                <div
                  className={cn(
                    'w-10 h-6 rounded-full transition-colors',
                    form.trackStock ? 'bg-accent' : 'bg-border',
                  )}
                />
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    form.trackStock ? 'translate-x-5' : 'translate-x-1',
                  )}
                />
              </div>
              <span className="text-sm text-text-primary">Track stock quantity</span>
            </label>

            {form.trackStock && (
              <Input
                label="Stock Quantity"
                type="number"
                min="0"
                step="1"
                value={form.stockQuantity}
                onChange={(e) => setField('stockQuantity', e.target.value)}
                placeholder="0"
              />
            )}
          </div>

          {/* ── Variants ── */}
          <div>
            <SectionHeader>Variants</SectionHeader>
            <p className="text-xs text-text-tertiary mb-3">
              Add variants like Size or Color. Customers will choose before adding to cart.
            </p>
            <VariantBuilder
              variants={form.variants}
              onChange={(v) => {
                setField('variants', v);
              }}
            />
          </div>
        </div>
      )}
    </Drawer>
  );
}