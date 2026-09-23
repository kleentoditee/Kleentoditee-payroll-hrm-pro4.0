# HR employee records (profile, IDs, documents)

## Summary

`Employee` rows now hold **full HR and payroll** data: profile photo, government-style identifiers, employment and work-permit dates, and **versioned file attachments** with **soft delete** only. The **employee tracker** app only receives a **strict subset** of non-sensitive fields (see [Privacy](#privacy)).

## Database

### Employee (additional columns)

| Field | Purpose |
|-------|--------|
| `profilePhotoPath` | Storage object key for the current profile image (see [Storage](#storage)). |
| `socialSecurityNumber` | SSN (sensitive; API masking + audit redaction). |
| `nationalHealthInsuranceNumber` | NHI (sensitive). |
| `inlandRevenueDepartmentNumber` | IRD / tax ID (sensitive). |
| `employmentStartDate`, `employmentEndDate` | HR employment window. |
| `workPermitNumber`, `workPermitExpiryDate` | Work permit (number is sensitive; dates are not by default). |
| `notes` | Free text; redacted in audit. |

### `EmployeeDocument`

| Field | Notes |
|-------|--------|
| `type` | `PHOTO` \| `WORK_PERMIT_CARD` \| `NHI_CARD` \| `ID_CARD` \| `CONTRACT` \| `OTHER` |
| `storagePath` | Storage object key resolved by the API document storage provider. |
| `deletedAt` | Set on “delete” — **no hard delete** in normal flow. |
| `uploadedByUserId` | Uploader; nullable on user removal. |

Uploading a **PHOTO** also updates `profilePhotoPath`. Soft-deleting a PHOTO document clears the profile path when it pointed at that file.

## Storage

- Local/default provider: filesystem storage under `apps/api/uploads/hr` (or `UPLOADS_DIR` env) **relative to the API process CWD** when the API is started from `apps/api`.
- The repo **ignores** `uploads/` and `apps/api/uploads/` in `.gitignore`.
- The API now resolves files through a document storage service. `OBJECT_STORAGE_PROVIDER=local` preserves current local behavior; `s3` and `r2` are explicit future placeholders and fail closed until an S3-compatible client is implemented.
- Production target: encrypted private bucket, short-lived signed URLs, malware scan hook before trust, retention/legal-hold controls, and audit logging around upload/download/delete/restore activity.

## API

### List — `GET /people/employees`

Returns **no** SSN, NHI, IRD, or raw paths to sensitive files. Each row includes:

- `hasProfilePhoto`, `linkedUser: { email, status } | null`, plus existing payroll/HR-safe columns.

### Detail — `GET /people/employees/:id`

Returns a **redacted** JSON payload. When the caller has one of `platform_owner`, `hr_admin`, or `payroll_admin`, unmasked `socialSecurityNumber`, `nationalHealthInsuranceNumber`, `inlandRevenueDepartmentNumber`, and `workPermitNumber` are included and `sensitiveExposed: true`. Otherwise, IDs are **masked** (last 4) and `sensitiveExposed: false`.

**Document list** is included. **File download** for `NHI_CARD`, `WORK_PERMIT_CARD`, and `ID_CARD` requires the same PII role set; `PHOTO`, `CONTRACT`, and `OTHER` are downloadable by any `CAN_VIEW` people role.

- `GET /people/employees/:id/profile-photo` — binary image, **any** `CAN_VIEW`.
- `GET /people/employees/:id/documents/:docId/file` — as above, **role + document type** checked.

**Upload** — `POST /people/employees/:id/documents` — `multipart/form-data` with `file` and `type`. Max 20MB.

**Soft delete** — `DELETE /people/employees/:id/documents/:docId`.

### Audit

`employee.create`, `employee.update`, and `employee.delete` store `before`/`after` with **sensitive string fields, notes, and `profilePhotoPath` redacted**. Updates include `metadata.sensitiveFieldNames` when a sensitive column was in the payload (names only, not values). Document events log type, file name, size, **not** file contents or paths in metadata.

## Admin UI

- **Employees list** — avatar (JWT-loaded), name, work email, phone, status, summary line.
- **Employee detail** — sections: profile photo, contact, employment dates, government IDs (mask + “show” for unmasked on authorized roles), payroll rates, documents with uploads per type, notes.

## Privacy

- No government IDs in **dashboard** aggregates, **lists**, or **shared tracker** messages.
- **Tracker** `GET /time/self/profile` returns only work/time-related fields, **not** SSN, NHI, IRD, or document paths.
- **Time** entry APIs embed a **restricted** `Employee` sub-object (`employeeForNestedTimeContextSelect`) so payroll/approval views never receive SSN, NHI, IRD, work permit, `profilePhotoPath`, or `notes` on the `employee` include.
- **Audit** never records raw ID values.

## Limitations

- **No** cloud object storage client yet; the S3/R2 provider path is a fail-closed placeholder behind the document storage abstraction.
- **Email/Slack** notifications are not implemented; administrators share links and credentials out of band.
- **20MB** upload limit per file; not configurable in-app.
- PII in **ID document images** is still present in the file for users who can download those types — the JSON masking does not redact the pixel content.
