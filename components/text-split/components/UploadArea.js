'use client';

import {
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Tooltip,
  Chip
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import React, { useRef, useState } from 'react';
import FileSourceDialog from './FileSourceDialog';
import DepartmentFileDialog from './DepartmentFileDialog';

export default function UploadArea({
  theme,
  files,
  uploading,
  uploadedFiles,
  onFileSelect,
  onRemoveFile,
  onUpload,
  selectedModel,
  onDepartmentFileSelect,
  queuedDepartmentIds
}) {
  const { t } = useTranslation();
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);

  // 拖拽进入
  const handleDragOver = e => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };
  // 拖拽离开
  const handleDragLeave = e => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  // 拖拽释放
  const handleDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!selectedModel?.id || uploading) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // 构造一个模拟的 event 以复用 onFileSelect
      const event = { target: { files } };
      onFileSelect(event);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        height: '100%',
        border: `2px dashed ${dragActive ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.2)}`,
        borderRadius: 2,
        bgcolor: dragActive ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.05),
        transition: 'all 0.3s ease',
        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          borderColor: alpha(theme.palette.primary.main, 0.3)
        },
        cursor: uploading || !selectedModel?.id ? 'not-allowed' : 'pointer',
        position: 'relative'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragActive && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            bgcolor: alpha(theme.palette.primary.main, 0.3),
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            borderRadius: 2,
            border: `3px solid ${theme.palette.primary.main}`,
            backdropFilter: 'blur(2px)'
          }}
        >
          <Box
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              p: 3,
              borderRadius: 1,
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              border: `1px solid ${theme.palette.primary.main}`
            }}
          >
            <UploadFileIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
              {t('textSplit.dragToUpload', { defaultValue: '拖拽文件到此处上传' })}
            </Typography>
          </Box>
        </Box>
      )}
      <Typography variant="subtitle1" gutterBottom>
        {t('textSplit.uploadNewDocument')}
      </Typography>

      <Tooltip
        title={!selectedModel?.id ? t('textSplit.selectModelFirst', { defaultValue: '请先在右上角选择模型' }) : ''}
      >
        <span>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            sx={{ mb: 2, mt: 2 }}
            disabled={!selectedModel?.id || uploading}
            onClick={() => setSourceDialogOpen(true)}
          >
            {t('textSplit.selectFile')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept=".md,.txt,.docx,.pdf,.epub"
            multiple
            onChange={event => {
              onFileSelect(event);
              event.target.value = '';
            }}
            disabled={!selectedModel?.id || uploading}
          />
        </span>
      </Tooltip>

      <Typography variant="body2" color="textSecondary">
        {uploadedFiles.total > 0 ? t('textSplit.mutilFileMessage') : t('textSplit.supportedFormats')}
      </Typography>

      {files.length > 0 && (
        <Box sx={{ mt: 3, width: '100%' }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('textSplit.selectedFiles', { count: files.length })}
          </Typography>

          <List sx={{ bgcolor: theme.palette.background.paper, borderRadius: 1, maxHeight: '200px', overflow: 'auto' }}>
            {files.map((file, index) => (
              <Box key={file.key || index}>
                <ListItem
                  secondaryAction={
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => onRemoveFile(index)}
                      disabled={uploading}
                    >
                      {t('common.delete')}
                    </Button>
                  }
                >
                  <ListItemText
                    primary={file.name}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Chip
                          component="span"
                          size="small"
                          label={
                            file.source === 'department'
                              ? t('textSplit.fileSource.department', { defaultValue: '部门文件' })
                              : t('textSplit.fileSource.local', { defaultValue: '本地文件' })
                          }
                        />
                        <Typography component="span" variant="caption" color="text.secondary">
                          {Number.isFinite(file.size)
                            ? `${(file.size / 1024).toFixed(2)} KB`
                            : t('textSplit.departmentFiles.unknownSize', { defaultValue: '大小未知' })}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                {index < files.length - 1 && <Divider />}
              </Box>
            ))}
          </List>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Tooltip
              title={
                !selectedModel?.id ? t('textSplit.selectModelFirst', { defaultValue: '请先在右上角选择模型' }) : ''
              }
            >
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={onUpload}
                  disabled={uploading || !selectedModel?.id}
                  sx={{ minWidth: 120 }}
                >
                  {uploading ? <CircularProgress size={24} /> : t('textSplit.uploadAndProcess')}
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      )}

      <FileSourceDialog
        open={sourceDialogOpen}
        onClose={() => setSourceDialogOpen(false)}
        onLocal={() => {
          setSourceDialogOpen(false);
          window.requestAnimationFrame(() => inputRef.current?.click());
        }}
        onDepartment={() => {
          setSourceDialogOpen(false);
          setDepartmentDialogOpen(true);
        }}
      />
      <DepartmentFileDialog
        open={departmentDialogOpen}
        onClose={() => setDepartmentDialogOpen(false)}
        onConfirm={onDepartmentFileSelect}
        queuedIds={queuedDepartmentIds}
      />
    </Box>
  );
}
