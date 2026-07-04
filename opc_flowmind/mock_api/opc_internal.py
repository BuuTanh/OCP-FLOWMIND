def get_erp_summary(contract_id: str) -> dict:
    return {
        "api_id": "API-007", "provider": "OPC Internal ERP",
        "status": "mock_success", "contract_id": contract_id,
        "erp_status": "active", "note": "MOCK DATA"
    }
