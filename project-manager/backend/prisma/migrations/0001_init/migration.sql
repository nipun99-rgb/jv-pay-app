Γùç injected env (3) from .env // tip: Γîü auth for agents [www.vestauth.com]
BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[clients] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [address] NVARCHAR(1000),
    [contact_email] NVARCHAR(1000),
    [contact_phone] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [clients_is_active_df] DEFAULT 1,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [clients_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [clients_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [clients_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [client_id] INT,
    [email] NVARCHAR(1000) NOT NULL,
    [display_name] NVARCHAR(1000) NOT NULL,
    [job_title] NVARCHAR(1000),
    [password_hash] NVARCHAR(1000),
    [entra_oid] NVARCHAR(1000),
    [last_login_at] DATETIME2,
    [is_active] BIT NOT NULL CONSTRAINT [users_is_active_df] DEFAULT 1,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [users_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [users_entra_oid_key] UNIQUE NONCLUSTERED ([entra_oid])
);

-- CreateTable
CREATE TABLE [dbo].[roles] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(1000) NOT NULL,
    [display_name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [roles_is_active_df] DEFAULT 1,
    CONSTRAINT [roles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [roles_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[user_roles] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [role_id] INT NOT NULL,
    [client_id] INT,
    [granted_by] INT,
    [granted_at] DATETIME2 NOT NULL CONSTRAINT [user_roles_granted_at_df] DEFAULT CURRENT_TIMESTAMP,
    [revoked_at] DATETIME2,
    [revoke_reason] NVARCHAR(1000),
    CONSTRAINT [user_roles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [user_roles_user_id_role_id_client_id_key] UNIQUE NONCLUSTERED ([user_id],[role_id],[client_id])
);

-- CreateTable
CREATE TABLE [dbo].[user_sessions] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [session_token] NVARCHAR(1000) NOT NULL,
    [ip_address] NVARCHAR(1000),
    [user_agent] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [user_sessions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [expires_at] DATETIME2 NOT NULL,
    [last_active_at] DATETIME2,
    [revoked_at] DATETIME2,
    CONSTRAINT [user_sessions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [user_sessions_session_token_key] UNIQUE NONCLUSTERED ([session_token])
);

-- CreateTable
CREATE TABLE [dbo].[contracts] (
    [id] INT NOT NULL IDENTITY(1,1),
    [client_id] INT NOT NULL,
    [contract_no] NVARCHAR(1000),
    [contract_name] NVARCHAR(1000) NOT NULL,
    [contractor_name] NVARCHAR(1000),
    [owner_name] NVARCHAR(1000),
    [project_description] NVARCHAR(1000),
    [project_location] NVARCHAR(1000),
    [contract_start_date] DATETIME2,
    [contract_end_date] DATETIME2,
    [original_contract_sum] DECIMAL(18,2),
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [contracts_currency_df] DEFAULT 'USD',
    [is_active] BIT NOT NULL CONSTRAINT [contracts_is_active_df] DEFAULT 1,
    [created_by] INT,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [contracts_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [contracts_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[contract_configs] (
    [id] INT NOT NULL IDENTITY(1,1),
    [contract_id] INT NOT NULL,
    [retainage_rate_pct] DECIMAL(18,2) NOT NULL CONSTRAINT [contract_configs_retainage_rate_pct_df] DEFAULT 10.0,
    [retainage_applies_to] NVARCHAR(1000) NOT NULL CONSTRAINT [contract_configs_retainage_applies_to_df] DEFAULT 'BOTH',
    [retainage_release_threshold_pct] DECIMAL(18,2) CONSTRAINT [contract_configs_retainage_release_threshold_pct_df] DEFAULT 50.0,
    [max_retainage_pct] DECIMAL(18,2) CONSTRAINT [contract_configs_max_retainage_pct_df] DEFAULT 10.0,
    [cross_file_tolerance_amt] DECIMAL(18,2) NOT NULL CONSTRAINT [contract_configs_cross_file_tolerance_amt_df] DEFAULT 10.0,
    [math_tolerance_amt] DECIMAL(18,2) NOT NULL CONSTRAINT [contract_configs_math_tolerance_amt_df] DEFAULT 0.01,
    [confidence_threshold] DECIMAL(18,2) NOT NULL CONSTRAINT [contract_configs_confidence_threshold_df] DEFAULT 0.80,
    [max_pct_complete] DECIMAL(18,2) NOT NULL CONSTRAINT [contract_configs_max_pct_complete_df] DEFAULT 100.0,
    [period_continuity_check] BIT NOT NULL CONSTRAINT [contract_configs_period_continuity_check_df] DEFAULT 1,
    [original_contract_sum] DECIMAL(18,2),
    [expected_retainage_pct_display] DECIMAL(18,2),
    [custom_rules_json] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [configured_by] INT,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [contract_configs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [contract_configs_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [contract_configs_contract_id_key] UNIQUE NONCLUSTERED ([contract_id])
);

-- CreateTable
CREATE TABLE [dbo].[ref_exception_types] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(1000) NOT NULL,
    [display_name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [severity] NVARCHAR(1000) NOT NULL,
    [routing] NVARCHAR(1000) NOT NULL,
    [can_bulk_resolve] BIT NOT NULL CONSTRAINT [ref_exception_types_can_bulk_resolve_df] DEFAULT 1,
    [requires_comment_on_override] BIT NOT NULL CONSTRAINT [ref_exception_types_requires_comment_on_override_df] DEFAULT 1,
    [is_active] BIT NOT NULL CONSTRAINT [ref_exception_types_is_active_df] DEFAULT 1,
    [sort_order] INT CONSTRAINT [ref_exception_types_sort_order_df] DEFAULT 99,
    CONSTRAINT [ref_exception_types_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ref_exception_types_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[ref_document_types] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(1000) NOT NULL,
    [display_name] NVARCHAR(1000) NOT NULL,
    [file_role] NVARCHAR(1000),
    [description] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [ref_document_types_is_active_df] DEFAULT 1,
    CONSTRAINT [ref_document_types_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ref_document_types_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[ref_validation_rule_types] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(1000) NOT NULL,
    [display_name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [produces_exception_type] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [ref_validation_rule_types_is_active_df] DEFAULT 1,
    CONSTRAINT [ref_validation_rule_types_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ref_validation_rule_types_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[packages] (
    [id] INT NOT NULL IDENTITY(1,1),
    [client_id] INT NOT NULL,
    [contract_id] INT NOT NULL,
    [billing_period_month] INT NOT NULL,
    [billing_period_year] INT NOT NULL,
    [billing_period_label] NVARCHAR(1000),
    [package_status] NVARCHAR(1000) NOT NULL CONSTRAINT [packages_package_status_df] DEFAULT 'DRAFT',
    [file_hash_1] NVARCHAR(1000),
    [file_hash_2] NVARCHAR(1000),
    [file_hash_3] NVARCHAR(1000),
    [total_items_extracted] INT,
    [auto_cleared_count] INT,
    [exceptions_count] INT,
    [dollar_at_risk] DECIMAL(18,2),
    [submitted_by] INT,
    [submitted_at] DATETIME2,
    [reviewed_by] INT,
    [reviewed_at] DATETIME2,
    [approved_by] INT,
    [approved_at] DATETIME2,
    [rejection_reason] NVARCHAR(1000),
    [created_by] INT,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [packages_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [packages_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [packages_contract_id_billing_period_month_billing_period_year_key] UNIQUE NONCLUSTERED ([contract_id],[billing_period_month],[billing_period_year])
);

-- CreateTable
CREATE TABLE [dbo].[package_documents] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [file_role] NVARCHAR(1000) NOT NULL,
    [original_filename] NVARCHAR(1000),
    [stored_path] NVARCHAR(1000),
    [sharepoint_url] NVARCHAR(1000),
    [file_size_bytes] INT,
    [page_count] INT,
    [file_hash] NVARCHAR(1000),
    [mime_type] NVARCHAR(1000) CONSTRAINT [package_documents_mime_type_df] DEFAULT 'application/pdf',
    [upload_status] NVARCHAR(1000) NOT NULL CONSTRAINT [package_documents_upload_status_df] DEFAULT 'PENDING',
    [quarantine_reason] NVARCHAR(1000),
    [classification_result] NVARCHAR(1000),
    [classification_confidence] DECIMAL(18,2),
    [uploaded_at] DATETIME2,
    [uploaded_by] INT,
    CONSTRAINT [package_documents_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [package_documents_package_id_file_role_key] UNIQUE NONCLUSTERED ([package_id],[file_role])
);

-- CreateTable
CREATE TABLE [dbo].[document_pages] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_document_id] INT NOT NULL,
    [page_no] INT NOT NULL,
    [width_pts] DECIMAL(18,2),
    [height_pts] DECIMAL(18,2),
    [rotation_degrees] INT CONSTRAINT [document_pages_rotation_degrees_df] DEFAULT 0,
    [ocr_text] NVARCHAR(1000),
    [classification] NVARCHAR(1000),
    [classification_confidence] DECIMAL(18,2),
    [is_blank] BIT CONSTRAINT [document_pages_is_blank_df] DEFAULT 0,
    CONSTRAINT [document_pages_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [document_pages_package_document_id_page_no_key] UNIQUE NONCLUSTERED ([package_document_id],[page_no])
);

-- CreateTable
CREATE TABLE [dbo].[processing_pipeline_steps] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [step_no] INT NOT NULL,
    [step_name] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [processing_pipeline_steps_status_df] DEFAULT 'pending',
    [sub_progress_current] INT,
    [sub_progress_total] INT,
    [sub_progress_label] NVARCHAR(1000),
    [started_at] DATETIME2,
    [completed_at] DATETIME2,
    [error_message] NVARCHAR(1000),
    [retry_count] INT CONSTRAINT [processing_pipeline_steps_retry_count_df] DEFAULT 0,
    CONSTRAINT [processing_pipeline_steps_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [processing_pipeline_steps_package_id_step_no_key] UNIQUE NONCLUSTERED ([package_id],[step_no])
);

-- CreateTable
CREATE TABLE [dbo].[agent_plans] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [confirmed_by] INT NOT NULL,
    [confirmed_at] DATETIME2 NOT NULL,
    [agent_identified_count] INT,
    [manually_added_count] INT CONSTRAINT [agent_plans_manually_added_count_df] DEFAULT 0,
    [notes] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [agent_plans_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [agent_plans_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [agent_plans_package_id_key] UNIQUE NONCLUSTERED ([package_id])
);

-- CreateTable
CREATE TABLE [dbo].[agent_plan_items] (
    [id] INT NOT NULL IDENTITY(1,1),
    [agent_plan_id] INT NOT NULL,
    [seq_no] INT NOT NULL,
    [subcontractor_name] NVARCHAR(1000) NOT NULL,
    [original_ocr_name] NVARCHAR(1000),
    [expected_app_no] NVARCHAR(1000),
    [billed_amount_file1] DECIMAL(18,2),
    [gc_sov_line_ids] NVARCHAR(1000),
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [agent_plan_items_source_df] DEFAULT 'AGENT',
    [is_manually_added] BIT NOT NULL CONSTRAINT [agent_plan_items_is_manually_added_df] DEFAULT 0,
    [notes] NVARCHAR(1000),
    CONSTRAINT [agent_plan_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[raw_extracted_fields] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_document_id] INT NOT NULL,
    [agent_run_id] NVARCHAR(1000),
    [page_no] INT,
    [field_name] NVARCHAR(1000),
    [field_category] NVARCHAR(1000),
    [raw_value] NVARCHAR(1000),
    [normalized_value] NVARCHAR(1000),
    [bbox_x] DECIMAL(18,2),
    [bbox_y] DECIMAL(18,2),
    [bbox_width] DECIMAL(18,2),
    [bbox_height] DECIMAL(18,2),
    [extraction_confidence] DECIMAL(18,2),
    [is_table_cell] BIT CONSTRAINT [raw_extracted_fields_is_table_cell_df] DEFAULT 0,
    [table_row_no] INT,
    [table_col_name] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [raw_extracted_fields_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [raw_extracted_fields_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[gc_pay_application_headers] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [agent_run_id] NVARCHAR(1000),
    [to_owner] NVARCHAR(1000),
    [from_contractor] NVARCHAR(1000),
    [project_name] NVARCHAR(1000),
    [application_no] NVARCHAR(1000),
    [period] NVARCHAR(1000),
    [period_from] NVARCHAR(1000),
    [period_to] NVARCHAR(1000),
    [original_contract_sum] DECIMAL(18,2),
    [net_change_orders] DECIMAL(18,2),
    [contract_sum_to_date] DECIMAL(18,2),
    [total_completed_stored] DECIMAL(18,2),
    [retainage_completed] DECIMAL(18,2),
    [retainage_materials] DECIMAL(18,2),
    [total_retainage] DECIMAL(18,2),
    [total_earned_less_ret] DECIMAL(18,2),
    [less_prev_certificates] DECIMAL(18,2),
    [current_payment_due] DECIMAL(18,2),
    [balance_to_finish] DECIMAL(18,2),
    [change_order_summary] NVARCHAR(1000),
    [architect_signature] NVARCHAR(1000),
    [contractor_signature] NVARCHAR(1000),
    [source_page] INT,
    [extraction_confidence] DECIMAL(18,2),
    [bbox_x] DECIMAL(18,2),
    [bbox_y] DECIMAL(18,2),
    [bbox_width] DECIMAL(18,2),
    [bbox_height] DECIMAL(18,2),
    [review_notes] NVARCHAR(1000),
    [validation_status] NVARCHAR(1000) CONSTRAINT [gc_pay_application_headers_validation_status_df] DEFAULT 'unchecked',
    [validation_notes] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [gc_pay_application_headers_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [gc_pay_application_headers_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [gc_pay_application_headers_package_id_key] UNIQUE NONCLUSTERED ([package_id])
);

-- CreateTable
CREATE TABLE [dbo].[gc_pay_application_sov_lines] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [agent_plan_item_id] INT,
    [item_no] NVARCHAR(1000),
    [time_period] NVARCHAR(1000),
    [phases] NVARCHAR(1000),
    [type_of_work] NVARCHAR(1000),
    [contractor_name] NVARCHAR(1000),
    [scheduled_original] DECIMAL(18,2) CONSTRAINT [gc_pay_application_sov_lines_scheduled_original_df] DEFAULT 0,
    [scheduled_change_orders] DECIMAL(18,2) CONSTRAINT [gc_pay_application_sov_lines_scheduled_change_orders_df] DEFAULT 0,
    [scheduled_current] DECIMAL(18,2) CONSTRAINT [gc_pay_application_sov_lines_scheduled_current_df] DEFAULT 0,
    [work_completed_prev] DECIMAL(18,2) CONSTRAINT [gc_pay_application_sov_lines_work_completed_prev_df] DEFAULT 0,
    [work_completed_this] DECIMAL(18,2) CONSTRAINT [gc_pay_application_sov_lines_work_completed_this_df] DEFAULT 0,
    [materials_stored] DECIMAL(18,2) CONSTRAINT [gc_pay_application_sov_lines_materials_stored_df] DEFAULT 0,
    [total_completed] DECIMAL(18,2) CONSTRAINT [gc_pay_application_sov_lines_total_completed_df] DEFAULT 0,
    [pct] DECIMAL(18,2) CONSTRAINT [gc_pay_application_sov_lines_pct_df] DEFAULT 0,
    [balance_to_finish] DECIMAL(18,2) CONSTRAINT [gc_pay_application_sov_lines_balance_to_finish_df] DEFAULT 0,
    [retainage] DECIMAL(18,2) CONSTRAINT [gc_pay_application_sov_lines_retainage_df] DEFAULT 0,
    [file2_extracted_amount] DECIMAL(18,2),
    [cross_file_variance] DECIMAL(18,2),
    [file2_matched_sub_app_id] INT,
    [source_page] INT,
    [extraction_confidence] DECIMAL(18,2),
    [bbox_page] INT,
    [bbox_x] DECIMAL(18,2),
    [bbox_y] DECIMAL(18,2),
    [bbox_width] DECIMAL(18,2),
    [bbox_height] DECIMAL(18,2),
    [review_notes] NVARCHAR(1000),
    [validation_status] NVARCHAR(1000) CONSTRAINT [gc_pay_application_sov_lines_validation_status_df] DEFAULT 'unchecked',
    [validation_note] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [gc_pay_application_sov_lines_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [gc_pay_application_sov_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[sub_pay_application_headers] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [agent_plan_item_id] INT,
    [seq_id] INT,
    [start_page] INT,
    [end_page] INT,
    [document_type] NVARCHAR(1000),
    [document_category] NVARCHAR(1000),
    [subcontractor_name] NVARCHAR(1000),
    [application_no] NVARCHAR(1000),
    [application_date] NVARCHAR(1000),
    [period_from] NVARCHAR(1000),
    [period_to] NVARCHAR(1000),
    [invoice_to] NVARCHAR(1000),
    [project_name_on_doc] NVARCHAR(1000),
    [contract_po_number] NVARCHAR(1000),
    [original_contract_sum] DECIMAL(18,2),
    [net_change_orders] DECIMAL(18,2),
    [contract_sum_to_date] DECIMAL(18,2),
    [total_completed_stored] DECIMAL(18,2),
    [completed_work_this_period] DECIMAL(18,2),
    [total_retainage] DECIMAL(18,2),
    [retainage_percent] DECIMAL(18,2),
    [total_earned_less_retainage] DECIMAL(18,2),
    [less_prev_certificates] DECIMAL(18,2),
    [current_payment_due] DECIMAL(18,2),
    [balance_to_finish] DECIMAL(18,2),
    [g703_scheduled_value] DECIMAL(18,2),
    [g703_work_prev] DECIMAL(18,2),
    [g703_work_this_period] DECIMAL(18,2),
    [g703_materials_stored] DECIMAL(18,2),
    [g703_total_completed] DECIMAL(18,2),
    [g703_retainage] DECIMAL(18,2),
    [g703_earned_less_ret] DECIMAL(18,2),
    [g703_balance_to_finish] DECIMAL(18,2),
    [recon_flag] NVARCHAR(1000),
    [contractor_signature] NVARCHAR(1000),
    [architect_signature] NVARCHAR(1000),
    [notarized] NVARCHAR(1000),
    [additional_supporting_docs] NVARCHAR(1000),
    [extraction_confidence] DECIMAL(18,2),
    [validation_status] NVARCHAR(1000) CONSTRAINT [sub_pay_application_headers_validation_status_df] DEFAULT 'unchecked',
    [validation_note] NVARCHAR(1000),
    [raw_json] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [sub_pay_application_headers_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [sub_pay_application_headers_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[sub_pay_application_sov_lines] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [sub_app_id] INT NOT NULL,
    [source_page] INT,
    [item_no] NVARCHAR(1000),
    [description] NVARCHAR(1000),
    [scheduled_value] DECIMAL(18,2),
    [work_completed_prev] DECIMAL(18,2),
    [work_completed_this] DECIMAL(18,2),
    [materials_stored] DECIMAL(18,2),
    [total_completed] DECIMAL(18,2),
    [pct_complete] DECIMAL(18,2),
    [retainage] DECIMAL(18,2),
    [balance_to_finish] DECIMAL(18,2),
    [extraction_confidence] DECIMAL(18,2),
    [bbox_page] INT,
    [bbox_x] DECIMAL(18,2),
    [bbox_y] DECIMAL(18,2),
    [bbox_width] DECIMAL(18,2),
    [bbox_height] DECIMAL(18,2),
    [validation_status] NVARCHAR(1000) CONSTRAINT [sub_pay_application_sov_lines_validation_status_df] DEFAULT 'unchecked',
    [validation_note] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [sub_pay_application_sov_lines_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [sub_pay_application_sov_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[supporting_document_items] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [package_document_id] INT NOT NULL,
    [page_no] INT,
    [document_type] NVARCHAR(1000),
    [vendor_name] NVARCHAR(1000),
    [invoice_date] NVARCHAR(1000),
    [invoice_no] NVARCHAR(1000),
    [description] NVARCHAR(1000),
    [amount] DECIMAL(18,2),
    [currency] NVARCHAR(1000) CONSTRAINT [supporting_document_items_currency_df] DEFAULT 'USD',
    [tax_amount] DECIMAL(18,2),
    [total_amount] DECIMAL(18,2),
    [linked_sov_line_id] INT,
    [match_confidence] DECIMAL(18,2),
    [match_method] NVARCHAR(1000),
    [extraction_confidence] DECIMAL(18,2),
    [bbox_page] INT,
    [bbox_x] DECIMAL(18,2),
    [bbox_y] DECIMAL(18,2),
    [bbox_width] DECIMAL(18,2),
    [bbox_height] DECIMAL(18,2),
    [validation_status] NVARCHAR(1000) CONSTRAINT [supporting_document_items_validation_status_df] DEFAULT 'unchecked',
    [validation_note] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [supporting_document_items_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [supporting_document_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[validation_runs] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [run_number] INT NOT NULL,
    [triggered_by] INT,
    [run_status] NVARCHAR(1000) NOT NULL CONSTRAINT [validation_runs_run_status_df] DEFAULT 'RUNNING',
    [run_started_at] DATETIME2 NOT NULL CONSTRAINT [validation_runs_run_started_at_df] DEFAULT CURRENT_TIMESTAMP,
    [run_completed_at] DATETIME2,
    [total_items] INT,
    [auto_cleared_count] INT,
    [exceptions_count] INT,
    [blocking_exceptions_count] INT,
    [dollar_at_risk] DECIMAL(18,2),
    [error_message] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [validation_runs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [validation_runs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[reconciliation_results] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [validation_run_id] INT NOT NULL,
    [reconciliation_type] NVARCHAR(1000) NOT NULL,
    [entity_type] NVARCHAR(1000),
    [entity_id] INT,
    [jv_amount] DECIMAL(18,2),
    [sub_amount] DECIMAL(18,2),
    [expected_amount] DECIMAL(18,2),
    [computed_amount] DECIMAL(18,2),
    [variance] DECIMAL(18,2),
    [tolerance_applied] DECIMAL(18,2),
    [passed] BIT NOT NULL,
    [failure_reason] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [reconciliation_results_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [reconciliation_results_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[exception_groups] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [validation_run_id] INT NOT NULL,
    [exception_type_code] NVARCHAR(1000) NOT NULL,
    [display_label] NVARCHAR(1000) NOT NULL,
    [severity] NVARCHAR(1000) NOT NULL,
    [item_count] INT NOT NULL CONSTRAINT [exception_groups_item_count_df] DEFAULT 0,
    [resolved_count] INT NOT NULL CONSTRAINT [exception_groups_resolved_count_df] DEFAULT 0,
    [dollar_at_risk] DECIMAL(18,2) NOT NULL CONSTRAINT [exception_groups_dollar_at_risk_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [exception_groups_status_df] DEFAULT 'open',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [exception_groups_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [exception_groups_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[exceptions] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [validation_run_id] INT NOT NULL,
    [exception_group_id] INT,
    [exception_type_code] NVARCHAR(1000) NOT NULL,
    [entity_type] NVARCHAR(1000),
    [entity_id] INT,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [file1_value] DECIMAL(18,2),
    [file2_value] DECIMAL(18,2),
    [expected_value] DECIMAL(18,2),
    [variance] DECIMAL(18,2),
    [dollar_at_risk] DECIMAL(18,2),
    [extraction_confidence] DECIMAL(18,2),
    [risk_rank] INT,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [exceptions_status_df] DEFAULT 'open',
    [evidence_document_id] INT NOT NULL,
    [evidence_page_no] INT,
    [evidence_bbox_x] DECIMAL(18,2),
    [evidence_bbox_y] DECIMAL(18,2),
    [evidence_bbox_width] DECIMAL(18,2),
    [evidence_bbox_height] DECIMAL(18,2),
    [evidence2_document_id] INT,
    [evidence2_page_no] INT,
    [evidence2_bbox_x] DECIMAL(18,2),
    [evidence2_bbox_y] DECIMAL(18,2),
    [evidence2_bbox_width] DECIMAL(18,2),
    [evidence2_bbox_height] DECIMAL(18,2),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [exceptions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2,
    CONSTRAINT [exceptions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[exception_resolutions] (
    [id] INT NOT NULL IDENTITY(1,1),
    [exception_id] INT NOT NULL,
    [resolved_by] INT NOT NULL,
    [resolved_at] DATETIME2 NOT NULL,
    [resolution_type] NVARCHAR(1000) NOT NULL,
    [override_value] DECIMAL(18,2),
    [override_field] NVARCHAR(1000),
    [comment] NVARCHAR(1000),
    [escalated_to_role] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [exception_resolutions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [exception_resolutions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[review_action_logs] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [user_id] INT NOT NULL,
    [action_type] NVARCHAR(1000) NOT NULL,
    [entity_type] NVARCHAR(1000),
    [entity_id] INT,
    [before_value] NVARCHAR(1000),
    [after_value] NVARCHAR(1000),
    [comment] NVARCHAR(1000),
    [ip_address] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [review_action_logs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [review_action_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_events] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [event_type] NVARCHAR(1000) NOT NULL,
    [triggered_by] INT NOT NULL,
    [triggered_at] DATETIME2 NOT NULL,
    [event_summary] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_events_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[activity_logs] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [level] NVARCHAR(1000) NOT NULL CONSTRAINT [activity_logs_level_df] DEFAULT 'info',
    [step_no] INT,
    [message] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [activity_logs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [activity_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[data_change_logs] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT NOT NULL,
    [entity_type] NVARCHAR(1000) NOT NULL,
    [entity_id] INT NOT NULL,
    [field_name] NVARCHAR(1000) NOT NULL,
    [original_value] NVARCHAR(1000),
    [new_value] NVARCHAR(1000),
    [changed_by] INT NOT NULL,
    [changed_at] DATETIME2 NOT NULL,
    [reason] NVARCHAR(1000) NOT NULL,
    [raw_field_id] INT,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [data_change_logs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [data_change_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[notifications] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [package_id] INT,
    [notification_type] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(1000) NOT NULL,
    [action_url] NVARCHAR(1000),
    [is_read] BIT NOT NULL CONSTRAINT [notifications_is_read_df] DEFAULT 0,
    [read_at] DATETIME2,
    [email_sent] BIT NOT NULL CONSTRAINT [notifications_email_sent_df] DEFAULT 0,
    [email_sent_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [notifications_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [notifications_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[notification_preferences] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [notification_type] NVARCHAR(1000) NOT NULL,
    [in_app_enabled] BIT NOT NULL CONSTRAINT [notification_preferences_in_app_enabled_df] DEFAULT 1,
    [email_enabled] BIT NOT NULL CONSTRAINT [notification_preferences_email_enabled_df] DEFAULT 0,
    [updated_at] DATETIME2,
    CONSTRAINT [notification_preferences_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [notification_preferences_user_id_notification_type_key] UNIQUE NONCLUSTERED ([user_id],[notification_type])
);

-- CreateTable
CREATE TABLE [dbo].[api_integration_logs] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_id] INT,
    [service_name] NVARCHAR(1000) NOT NULL,
    [operation] NVARCHAR(1000) NOT NULL,
    [request_url] NVARCHAR(1000),
    [http_method] NVARCHAR(1000),
    [request_payload_size_bytes] INT,
    [response_status_code] INT,
    [response_payload_size_bytes] INT,
    [duration_ms] INT,
    [success] BIT NOT NULL,
    [error_code] NVARCHAR(1000),
    [error_message] NVARCHAR(1000),
    [tokens_used] INT,
    [cost_estimate_usd] DECIMAL(18,2),
    [agent_run_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [api_integration_logs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [api_integration_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[sharepoint_document_refs] (
    [id] INT NOT NULL IDENTITY(1,1),
    [package_document_id] INT NOT NULL,
    [sharepoint_site_id] NVARCHAR(1000),
    [sharepoint_drive_id] NVARCHAR(1000),
    [sharepoint_item_id] NVARCHAR(1000),
    [sharepoint_url] NVARCHAR(1000),
    [sharepoint_version] NVARCHAR(1000),
    [uploaded_at] DATETIME2,
    [last_synced_at] DATETIME2,
    [retention_label] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [sharepoint_document_refs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [sharepoint_document_refs_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [sharepoint_document_refs_package_document_id_key] UNIQUE NONCLUSTERED ([package_document_id])
);

-- CreateTable
CREATE TABLE [dbo].[system_configs] (
    [id] INT NOT NULL IDENTITY(1,1),
    [config_key] NVARCHAR(1000) NOT NULL,
    [config_value] NVARCHAR(1000) NOT NULL,
    [data_type] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [is_sensitive] BIT NOT NULL CONSTRAINT [system_configs_is_sensitive_df] DEFAULT 0,
    [updated_by] INT,
    [updated_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [system_configs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [system_configs_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [system_configs_config_key_key] UNIQUE NONCLUSTERED ([config_key])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [clients_is_active_idx] ON [dbo].[clients]([is_active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_client_id_idx] ON [dbo].[users]([client_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_is_active_idx] ON [dbo].[users]([is_active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [user_roles_user_id_idx] ON [dbo].[user_roles]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [user_roles_client_id_idx] ON [dbo].[user_roles]([client_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [user_roles_role_id_idx] ON [dbo].[user_roles]([role_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [user_sessions_user_id_idx] ON [dbo].[user_sessions]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [user_sessions_expires_at_idx] ON [dbo].[user_sessions]([expires_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [contracts_client_id_idx] ON [dbo].[contracts]([client_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [contracts_is_active_idx] ON [dbo].[contracts]([is_active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [contracts_contract_no_idx] ON [dbo].[contracts]([contract_no]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [packages_contract_id_idx] ON [dbo].[packages]([contract_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [packages_client_id_idx] ON [dbo].[packages]([client_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [packages_package_status_idx] ON [dbo].[packages]([package_status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [packages_billing_period_year_idx] ON [dbo].[packages]([billing_period_year]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [package_documents_package_id_idx] ON [dbo].[package_documents]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [package_documents_file_role_idx] ON [dbo].[package_documents]([file_role]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [package_documents_upload_status_idx] ON [dbo].[package_documents]([upload_status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [document_pages_package_document_id_idx] ON [dbo].[document_pages]([package_document_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [document_pages_classification_idx] ON [dbo].[document_pages]([classification]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [processing_pipeline_steps_package_id_idx] ON [dbo].[processing_pipeline_steps]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [processing_pipeline_steps_status_idx] ON [dbo].[processing_pipeline_steps]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [agent_plan_items_agent_plan_id_idx] ON [dbo].[agent_plan_items]([agent_plan_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [agent_plan_items_source_idx] ON [dbo].[agent_plan_items]([source]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [raw_extracted_fields_package_document_id_idx] ON [dbo].[raw_extracted_fields]([package_document_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [raw_extracted_fields_agent_run_id_idx] ON [dbo].[raw_extracted_fields]([agent_run_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [raw_extracted_fields_page_no_idx] ON [dbo].[raw_extracted_fields]([page_no]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [raw_extracted_fields_field_name_idx] ON [dbo].[raw_extracted_fields]([field_name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [raw_extracted_fields_extraction_confidence_idx] ON [dbo].[raw_extracted_fields]([extraction_confidence]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [gc_pay_application_sov_lines_package_id_idx] ON [dbo].[gc_pay_application_sov_lines]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [gc_pay_application_sov_lines_contractor_name_idx] ON [dbo].[gc_pay_application_sov_lines]([contractor_name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [gc_pay_application_sov_lines_validation_status_idx] ON [dbo].[gc_pay_application_sov_lines]([validation_status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [gc_pay_application_sov_lines_agent_plan_item_id_idx] ON [dbo].[gc_pay_application_sov_lines]([agent_plan_item_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sub_pay_application_headers_package_id_idx] ON [dbo].[sub_pay_application_headers]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sub_pay_application_headers_agent_plan_item_id_idx] ON [dbo].[sub_pay_application_headers]([agent_plan_item_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sub_pay_application_headers_subcontractor_name_idx] ON [dbo].[sub_pay_application_headers]([subcontractor_name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sub_pay_application_headers_validation_status_idx] ON [dbo].[sub_pay_application_headers]([validation_status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sub_pay_application_sov_lines_package_id_idx] ON [dbo].[sub_pay_application_sov_lines]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sub_pay_application_sov_lines_sub_app_id_idx] ON [dbo].[sub_pay_application_sov_lines]([sub_app_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [supporting_document_items_package_id_idx] ON [dbo].[supporting_document_items]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [supporting_document_items_package_document_id_idx] ON [dbo].[supporting_document_items]([package_document_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [supporting_document_items_linked_sov_line_id_idx] ON [dbo].[supporting_document_items]([linked_sov_line_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [supporting_document_items_document_type_idx] ON [dbo].[supporting_document_items]([document_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [validation_runs_package_id_idx] ON [dbo].[validation_runs]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [validation_runs_run_status_idx] ON [dbo].[validation_runs]([run_status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reconciliation_results_package_id_idx] ON [dbo].[reconciliation_results]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reconciliation_results_validation_run_id_idx] ON [dbo].[reconciliation_results]([validation_run_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reconciliation_results_entity_type_idx] ON [dbo].[reconciliation_results]([entity_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reconciliation_results_passed_idx] ON [dbo].[reconciliation_results]([passed]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exception_groups_package_id_idx] ON [dbo].[exception_groups]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exception_groups_exception_type_code_idx] ON [dbo].[exception_groups]([exception_type_code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exception_groups_status_idx] ON [dbo].[exception_groups]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exceptions_package_id_idx] ON [dbo].[exceptions]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exceptions_exception_type_code_idx] ON [dbo].[exceptions]([exception_type_code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exceptions_exception_group_id_idx] ON [dbo].[exceptions]([exception_group_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exceptions_status_idx] ON [dbo].[exceptions]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exceptions_risk_rank_idx] ON [dbo].[exceptions]([risk_rank]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exceptions_entity_type_idx] ON [dbo].[exceptions]([entity_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exception_resolutions_exception_id_idx] ON [dbo].[exception_resolutions]([exception_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exception_resolutions_resolved_by_idx] ON [dbo].[exception_resolutions]([resolved_by]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [exception_resolutions_resolution_type_idx] ON [dbo].[exception_resolutions]([resolution_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_action_logs_package_id_idx] ON [dbo].[review_action_logs]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_action_logs_user_id_idx] ON [dbo].[review_action_logs]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_action_logs_action_type_idx] ON [dbo].[review_action_logs]([action_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_action_logs_created_at_idx] ON [dbo].[review_action_logs]([created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_events_package_id_idx] ON [dbo].[audit_events]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_events_event_type_idx] ON [dbo].[audit_events]([event_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_events_triggered_at_idx] ON [dbo].[audit_events]([triggered_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_logs_package_id_idx] ON [dbo].[activity_logs]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_logs_step_no_idx] ON [dbo].[activity_logs]([step_no]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_logs_created_at_idx] ON [dbo].[activity_logs]([created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [data_change_logs_package_id_idx] ON [dbo].[data_change_logs]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [data_change_logs_entity_type_idx] ON [dbo].[data_change_logs]([entity_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [data_change_logs_changed_by_idx] ON [dbo].[data_change_logs]([changed_by]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [data_change_logs_changed_at_idx] ON [dbo].[data_change_logs]([changed_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_user_id_idx] ON [dbo].[notifications]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_is_read_idx] ON [dbo].[notifications]([is_read]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_created_at_idx] ON [dbo].[notifications]([created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_package_id_idx] ON [dbo].[notifications]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [api_integration_logs_package_id_idx] ON [dbo].[api_integration_logs]([package_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [api_integration_logs_service_name_idx] ON [dbo].[api_integration_logs]([service_name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [api_integration_logs_success_idx] ON [dbo].[api_integration_logs]([success]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [api_integration_logs_created_at_idx] ON [dbo].[api_integration_logs]([created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sharepoint_document_refs_sharepoint_item_id_idx] ON [dbo].[sharepoint_document_refs]([sharepoint_item_id]);

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_client_id_fkey] FOREIGN KEY ([client_id]) REFERENCES [dbo].[clients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [user_roles_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [user_roles_role_id_fkey] FOREIGN KEY ([role_id]) REFERENCES [dbo].[roles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [user_roles_client_id_fkey] FOREIGN KEY ([client_id]) REFERENCES [dbo].[clients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [user_roles_granted_by_fkey] FOREIGN KEY ([granted_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_sessions] ADD CONSTRAINT [user_sessions_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[contracts] ADD CONSTRAINT [contracts_client_id_fkey] FOREIGN KEY ([client_id]) REFERENCES [dbo].[clients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[contracts] ADD CONSTRAINT [contracts_created_by_fkey] FOREIGN KEY ([created_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[contract_configs] ADD CONSTRAINT [contract_configs_contract_id_fkey] FOREIGN KEY ([contract_id]) REFERENCES [dbo].[contracts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[contract_configs] ADD CONSTRAINT [contract_configs_configured_by_fkey] FOREIGN KEY ([configured_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[packages] ADD CONSTRAINT [packages_client_id_fkey] FOREIGN KEY ([client_id]) REFERENCES [dbo].[clients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[packages] ADD CONSTRAINT [packages_contract_id_fkey] FOREIGN KEY ([contract_id]) REFERENCES [dbo].[contracts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[packages] ADD CONSTRAINT [packages_submitted_by_fkey] FOREIGN KEY ([submitted_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[packages] ADD CONSTRAINT [packages_reviewed_by_fkey] FOREIGN KEY ([reviewed_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[packages] ADD CONSTRAINT [packages_approved_by_fkey] FOREIGN KEY ([approved_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[packages] ADD CONSTRAINT [packages_created_by_fkey] FOREIGN KEY ([created_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[package_documents] ADD CONSTRAINT [package_documents_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[package_documents] ADD CONSTRAINT [package_documents_uploaded_by_fkey] FOREIGN KEY ([uploaded_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[document_pages] ADD CONSTRAINT [document_pages_package_document_id_fkey] FOREIGN KEY ([package_document_id]) REFERENCES [dbo].[package_documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[processing_pipeline_steps] ADD CONSTRAINT [processing_pipeline_steps_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[agent_plans] ADD CONSTRAINT [agent_plans_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[agent_plans] ADD CONSTRAINT [agent_plans_confirmed_by_fkey] FOREIGN KEY ([confirmed_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[agent_plan_items] ADD CONSTRAINT [agent_plan_items_agent_plan_id_fkey] FOREIGN KEY ([agent_plan_id]) REFERENCES [dbo].[agent_plans]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[raw_extracted_fields] ADD CONSTRAINT [raw_extracted_fields_package_document_id_fkey] FOREIGN KEY ([package_document_id]) REFERENCES [dbo].[package_documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[gc_pay_application_headers] ADD CONSTRAINT [gc_pay_application_headers_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[gc_pay_application_sov_lines] ADD CONSTRAINT [gc_pay_application_sov_lines_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[gc_pay_application_sov_lines] ADD CONSTRAINT [gc_pay_application_sov_lines_agent_plan_item_id_fkey] FOREIGN KEY ([agent_plan_item_id]) REFERENCES [dbo].[agent_plan_items]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[gc_pay_application_sov_lines] ADD CONSTRAINT [gc_pay_application_sov_lines_file2_matched_sub_app_id_fkey] FOREIGN KEY ([file2_matched_sub_app_id]) REFERENCES [dbo].[sub_pay_application_headers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sub_pay_application_headers] ADD CONSTRAINT [sub_pay_application_headers_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sub_pay_application_headers] ADD CONSTRAINT [sub_pay_application_headers_agent_plan_item_id_fkey] FOREIGN KEY ([agent_plan_item_id]) REFERENCES [dbo].[agent_plan_items]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sub_pay_application_sov_lines] ADD CONSTRAINT [sub_pay_application_sov_lines_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sub_pay_application_sov_lines] ADD CONSTRAINT [sub_pay_application_sov_lines_sub_app_id_fkey] FOREIGN KEY ([sub_app_id]) REFERENCES [dbo].[sub_pay_application_headers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[supporting_document_items] ADD CONSTRAINT [supporting_document_items_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[supporting_document_items] ADD CONSTRAINT [supporting_document_items_package_document_id_fkey] FOREIGN KEY ([package_document_id]) REFERENCES [dbo].[package_documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[supporting_document_items] ADD CONSTRAINT [supporting_document_items_linked_sov_line_id_fkey] FOREIGN KEY ([linked_sov_line_id]) REFERENCES [dbo].[gc_pay_application_sov_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[validation_runs] ADD CONSTRAINT [validation_runs_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[validation_runs] ADD CONSTRAINT [validation_runs_triggered_by_fkey] FOREIGN KEY ([triggered_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reconciliation_results] ADD CONSTRAINT [reconciliation_results_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reconciliation_results] ADD CONSTRAINT [reconciliation_results_validation_run_id_fkey] FOREIGN KEY ([validation_run_id]) REFERENCES [dbo].[validation_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[exception_groups] ADD CONSTRAINT [exception_groups_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[exception_groups] ADD CONSTRAINT [exception_groups_validation_run_id_fkey] FOREIGN KEY ([validation_run_id]) REFERENCES [dbo].[validation_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[exceptions] ADD CONSTRAINT [exceptions_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[exceptions] ADD CONSTRAINT [exceptions_validation_run_id_fkey] FOREIGN KEY ([validation_run_id]) REFERENCES [dbo].[validation_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[exceptions] ADD CONSTRAINT [exceptions_exception_group_id_fkey] FOREIGN KEY ([exception_group_id]) REFERENCES [dbo].[exception_groups]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[exceptions] ADD CONSTRAINT [exceptions_evidence_document_id_fkey] FOREIGN KEY ([evidence_document_id]) REFERENCES [dbo].[package_documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[exceptions] ADD CONSTRAINT [exceptions_evidence2_document_id_fkey] FOREIGN KEY ([evidence2_document_id]) REFERENCES [dbo].[package_documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[exception_resolutions] ADD CONSTRAINT [exception_resolutions_exception_id_fkey] FOREIGN KEY ([exception_id]) REFERENCES [dbo].[exceptions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[exception_resolutions] ADD CONSTRAINT [exception_resolutions_resolved_by_fkey] FOREIGN KEY ([resolved_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[review_action_logs] ADD CONSTRAINT [review_action_logs_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[review_action_logs] ADD CONSTRAINT [review_action_logs_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_events] ADD CONSTRAINT [audit_events_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_events] ADD CONSTRAINT [audit_events_triggered_by_fkey] FOREIGN KEY ([triggered_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[activity_logs] ADD CONSTRAINT [activity_logs_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[data_change_logs] ADD CONSTRAINT [data_change_logs_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[data_change_logs] ADD CONSTRAINT [data_change_logs_changed_by_fkey] FOREIGN KEY ([changed_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[data_change_logs] ADD CONSTRAINT [data_change_logs_raw_field_id_fkey] FOREIGN KEY ([raw_field_id]) REFERENCES [dbo].[raw_extracted_fields]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[notifications] ADD CONSTRAINT [notifications_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[notifications] ADD CONSTRAINT [notifications_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[notification_preferences] ADD CONSTRAINT [notification_preferences_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[api_integration_logs] ADD CONSTRAINT [api_integration_logs_package_id_fkey] FOREIGN KEY ([package_id]) REFERENCES [dbo].[packages]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sharepoint_document_refs] ADD CONSTRAINT [sharepoint_document_refs_package_document_id_fkey] FOREIGN KEY ([package_document_id]) REFERENCES [dbo].[package_documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_configs] ADD CONSTRAINT [system_configs_updated_by_fkey] FOREIGN KEY ([updated_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

