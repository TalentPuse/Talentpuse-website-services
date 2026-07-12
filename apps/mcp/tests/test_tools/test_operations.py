import pytest
from unittest.mock import AsyncMock, patch

from mcp_server.schemas.operations import AlertDispatchResult


class TestRunAlertDispatchTool:

    @pytest.mark.asyncio
    async def test_dispatch_success(self):
        from mcp_server.tools.operations import run_alert_dispatch

        dispatch_result = AlertDispatchResult(
            status="success",
            alerts_sent=23,
            message="Done",
        )

        with patch("mcp_server.tools.operations._alert_repo") as mock_repo:
            mock_repo.dispatch = AsyncMock(return_value=dispatch_result)
            result = await run_alert_dispatch()

        assert '"status":"success"' in result
        assert '"alerts_sent":23' in result
        assert '"Done"' in result

    @pytest.mark.asyncio
    async def test_dispatch_error(self):
        from mcp_server.tools.operations import run_alert_dispatch

        dispatch_result = AlertDispatchResult(
            status="error",
            alerts_sent=0,
            message="Connection refused",
        )

        with patch("mcp_server.tools.operations._alert_repo") as mock_repo:
            mock_repo.dispatch = AsyncMock(return_value=dispatch_result)
            result = await run_alert_dispatch()

        assert '"status":"error"' in result
        assert '"Connection refused"' in result
