import sys
import builtins
import pytest

def test_app_imports_cleanly_without_sumo_or_traci():
    # Simulate a cloud/serverless environment where SUMO and traci are completely missing
    orig_import = builtins.__import__
    def fake_import(name, *args, **kwargs):
        if name == 'traci':
            raise ModuleNotFoundError("No module named 'traci'")
        return orig_import(name, *args, **kwargs)

    builtins.__import__ = fake_import
    try:
        import importlib
        sys.modules.pop('app.services.simulation', None)
        sys.modules.pop('app.services.optimizer', None)
        
        sim = importlib.import_module('app.services.simulation')
        assert sim.traci is None
        res = sim.simulation_service.run_simulation()
        assert "completed_vehicles" in res
        assert "throughput" in res

        opt = importlib.import_module('app.services.optimizer')
        assert opt.traci is None

        import app.main as main_mod
        assert main_mod.app is not None
    finally:
        builtins.__import__ = orig_import
        # Restore normal modules for subsequent tests
        sys.modules.pop('app.services.simulation', None)
        sys.modules.pop('app.services.optimizer', None)
