'use client';

import {
  Alert,
  Box,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { DEPARTMENT_DESTINATION, LOCAL_DESTINATION } from '@/lib/export/artifact-delivery';

export function DepartmentMetadataFields({ metadata, onChange, suggestedFileName = '', suggestedTitle = '' }) {
  const { t } = useTranslation();
  const update = field => event => onChange({ ...metadata, [field]: event.target.value });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity="info">
        {t('export.departmentFixedHint', { defaultValue: '将上传至信息中心部门文档库（testbucketname）' })}
      </Alert>
      <TextField
        size="small"
        label={t('export.departmentFileName', { defaultValue: '文件名（留空则自动生成）' })}
        placeholder={suggestedFileName}
        value={metadata.fileName}
        onChange={update('fileName')}
        fullWidth
      />
      <TextField
        size="small"
        required
        label={t('export.departmentFileTitle', { defaultValue: '文件标题' })}
        placeholder={suggestedTitle}
        value={metadata.fileTitle}
        onChange={update('fileTitle')}
        fullWidth
      />
      <TextField
        select
        size="small"
        required
        label={t('export.secretLevel', { defaultValue: '密级' })}
        value={metadata.secretLevel}
        onChange={update('secretLevel')}
        fullWidth
      >
        {['公开', '内部', '秘密', '机密'].map(level => (
          <MenuItem key={level} value={level}>
            {level}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        size="small"
        label={t('export.keywords', { defaultValue: '关键词（选填）' })}
        value={metadata.keywords}
        onChange={update('keywords')}
        fullWidth
      />
      <TextField
        size="small"
        multiline
        minRows={2}
        label={t('export.summary', { defaultValue: '摘要（选填）' })}
        value={metadata.summary}
        onChange={update('summary')}
        fullWidth
      />
    </Box>
  );
}

export default function ExportDestinationFields({
  destination,
  onDestinationChange,
  metadata,
  onMetadataChange,
  suggestedFileName,
  suggestedTitle
}) {
  const { t } = useTranslation();

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <FormControl component="fieldset" fullWidth>
        <FormLabel component="legend">{t('export.destination', { defaultValue: '输出位置' })}</FormLabel>
        <RadioGroup row value={destination} onChange={event => onDestinationChange(event.target.value)}>
          <FormControlLabel
            value={LOCAL_DESTINATION}
            control={<Radio />}
            label={t('export.downloadLocal', { defaultValue: '下载到本地' })}
          />
          <FormControlLabel
            value={DEPARTMENT_DESTINATION}
            control={<Radio />}
            label={t('export.uploadDepartment', { defaultValue: '上传至部门文档库' })}
          />
        </RadioGroup>
      </FormControl>
      {destination === DEPARTMENT_DESTINATION && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            {t('export.departmentMetadata', { defaultValue: '部门文档信息' })}
          </Typography>
          <DepartmentMetadataFields
            metadata={metadata}
            onChange={onMetadataChange}
            suggestedFileName={suggestedFileName}
            suggestedTitle={suggestedTitle}
          />
        </Box>
      )}
    </>
  );
}
