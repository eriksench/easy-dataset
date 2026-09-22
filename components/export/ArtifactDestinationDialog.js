'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ExportDestinationFields from './ExportDestinationFields';
import { createDepartmentMetadata, LOCAL_DESTINATION } from '@/lib/export/artifact-delivery';

export default function ArtifactDestinationDialog({
  open,
  onClose,
  onConfirm,
  title,
  suggestedFileName,
  suggestedTitle
}) {
  const { t } = useTranslation();
  const [destination, setDestination] = useState(LOCAL_DESTINATION);
  const [metadata, setMetadata] = useState(createDepartmentMetadata({ fileTitle: suggestedTitle || '' }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDestination(LOCAL_DESTINATION);
      setMetadata(createDepartmentMetadata({ fileTitle: suggestedTitle || '' }));
      setError('');
    }
  }, [open, suggestedTitle]);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setError('');
      const success = await onConfirm({ destination, departmentMetadata: metadata });
      if (success !== false) onClose();
    } catch (submitError) {
      setError(submitError.message || '导出失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title || t('export.title', { defaultValue: '导出' })}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
            {error}
          </Alert>
        )}
        <ExportDestinationFields
          destination={destination}
          onDestinationChange={setDestination}
          metadata={metadata}
          onMetadataChange={setMetadata}
          suggestedFileName={suggestedFileName}
          suggestedTitle={suggestedTitle}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {t('common.cancel', { defaultValue: '取消' })}
        </Button>
        <Button variant="contained" onClick={handleConfirm} disabled={submitting}>
          {submitting && <CircularProgress size={16} sx={{ mr: 1 }} />}
          {destination === 'department'
            ? t('export.confirmUpload', { defaultValue: '确认上传' })
            : t('export.confirmExport', { defaultValue: '确认导出' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
