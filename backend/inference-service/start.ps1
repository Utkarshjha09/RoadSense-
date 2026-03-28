$ErrorActionPreference = "Stop"

$serviceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $serviceRoot

if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

$activate = Join-Path $serviceRoot ".venv\Scripts\Activate.ps1"
. $activate

python -m pip install --upgrade pip
pip install -r requirements.txt

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
