'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Pagination,
  Select,
  TextField,
  Typography,
  Button
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fileApi } from '@/lib/api';

const PAGE_SIZE = 10;

export default function DepartmentFileDialog({ open, onClose, onConfirm, queuedIds = [] }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [secretLevel, setSecretLevel] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ departmentName: '信息中心', total: 0, items: [] });
  const [selected, setSelected] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const queuedSet = useMemo(() => new Set(queuedIds.map(String)), [queuedIds]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    setQuery('');
    setDebouncedQuery('');
    setSecretLevel('');
    setPage(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError('');
    fileApi
      .getDepartmentFiles({ fileName: debouncedQuery, secretLevel, pageNo: page, pageSize: PAGE_SIZE })
      .then(result => {
        if (active) setData(result);
      })
      .catch(fetchError => {
        if (active) setError(fetchError.message || t('textSplit.departmentFiles.loadFailed'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, debouncedQuery, secretLevel, page, t]);

  const toggleFile = file => {
    if (!file.supported || queuedSet.has(String(file.id))) return;
    setSelected(previous => {
      const next = new Map(previous);
      if (next.has(String(file.id))) next.delete(String(file.id));
      else next.set(String(file.id), file);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected.values()));
    onClose();
  };

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('textSplit.departmentFiles.title', { defaultValue: '选择部门文件' })}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('textSplit.departmentFiles.currentDepartment', {
            defaultValue: '当前部门：{{department}}',
            department: data.departmentName || '信息中心'
          })}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setPage(1);
            }}
            label={t('textSplit.departmentFiles.search', { defaultValue: '搜索文件名' })}
            fullWidth
            size="small"
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('textSplit.departmentFiles.secretLevel', { defaultValue: '密级' })}</InputLabel>
            <Select
              value={secretLevel}
              label={t('textSplit.departmentFiles.secretLevel', { defaultValue: '密级' })}
              onChange={event => {
                setSecretLevel(event.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">{t('common.all', { defaultValue: '全部' })}</MenuItem>
              {['公开', '内部', '秘密', '机密'].map(level => (
                <MenuItem value={level} key={level}>
                  {level}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ minHeight: 360, border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
          {loading ? (
            <Box sx={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : data.items.length === 0 ? (
            <Box sx={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="text.secondary">
                {t('textSplit.departmentFiles.empty', { defaultValue: '没有找到部门文件' })}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {data.items.map(file => {
                const id = String(file.id);
                const queued = queuedSet.has(id);
                const disabled = !file.supported || queued;
                return (
                  <ListItem
                    key={id}
                    disablePadding
                    divider
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1, mr: 1 }}>
                        {file.secretLevel && <Chip label={file.secretLevel} size="small" />}
                        <Chip label={file.extension || '-'} size="small" variant="outlined" />
                      </Box>
                    }
                  >
                    <ListItemButton onClick={() => toggleFile(file)} disabled={disabled}>
                      <Checkbox edge="start" checked={selected.has(id) || queued} disabled={disabled} />
                      <ListItemText
                        primary={file.fileName}
                        secondary={
                          queued
                            ? t('textSplit.departmentFiles.alreadyAdded', { defaultValue: '已加入待上传列表' })
                            : !file.supported
                              ? t('textSplit.departmentFiles.unsupported', {
                                  defaultValue: 'Easy Dataset 不支持此格式'
                                })
                              : undefined
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2">
            {t('textSplit.departmentFiles.selectedCount', {
              defaultValue: '已选择 {{count}} 个文件',
              count: selected.size
            })}
          </Typography>
          <Pagination count={totalPages} page={Math.min(page, totalPages)} onChange={(_, value) => setPage(value)} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={selected.size === 0}>
          {t('textSplit.departmentFiles.addSelected', { defaultValue: '添加所选文件' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
