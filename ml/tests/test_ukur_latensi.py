"""
ml/tests/test_ukur_latensi.py
=============================
Tes skrip pengukur latensi tanpa memerlukan server Next.js.
"""

import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from unittest.mock import MagicMock, patch

from ukur_latensi import kirim, persentil, pilih_kontrak, ringkas

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data_simulasi")


class _Handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802 (nama metode bawaan http.server)
        panjang = int(self.headers.get("Content-Length", "0"))
        badan = json.loads(self.rfile.read(panjang) or b"{}")
        assert badan["simpan"] is False
        isi = json.dumps({"keputusan": "normal", "waktu_proses_ms": 12.5}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(isi)))
        self.end_headers()
        self.wfile.write(isi)

    def log_message(self, *args):  # senyapkan log uji
        return


@pytest.fixture(scope="module")
def server():
    httpd = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()
    thread.join(timeout=5)


def test_kirim_membaca_waktu_proses_dari_respons():
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps({"keputusan": "normal", "waktu_proses_ms": 12.5}).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.__exit__.return_value = None

    with patch("urllib.request.urlopen", return_value=mock_resp):
        total, proses = kirim("http://127.0.0.1:5000", {"simpan": False}, timeout=5)
        assert proses == 12.5
        assert total >= 0.0


def test_kirim_menolak_server_tidak_ada():
    with pytest.raises(SystemExit):
        kirim("http://127.0.0.1:9", {"simpan": False}, timeout=1)


def test_persentil_dan_ringkas():
    nilai = [float(i) for i in range(1, 101)]
    assert persentil(nilai, 50) == pytest.approx(50.5)
    assert persentil(nilai, 95) == pytest.approx(95.05)
    assert persentil([7.0], 95) == 7.0

    hasil = ringkas(nilai)
    assert hasil["n"] == 100
    assert hasil["median"] == 50.5
    assert hasil["p95"] == 95.05
    assert hasil["min"] == 1.0
    assert hasil["maks"] == 100.0
    assert ringkas([]) == {"n": 0, "median": None, "p95": None, "min": None, "maks": None}


def test_pilih_kontrak_memakai_registri_simulasi():
    assert os.path.exists(os.path.join(DATA_DIR, "registri_kontrak.csv"))
    payload = pilih_kontrak("PRJ-0001-K01", None)
    assert payload["kontrak_id"] == "PRJ-0001-K01"
    assert payload["project_id"] == "PRJ-0001"
    assert payload["simpan"] is False
    assert payload["nilai_pencairan"] > 0
    assert payload["kategori_hijau"]


def test_pilih_kontrak_menolak_kontrak_tidak_dikenal():
    with pytest.raises(SystemExit):
        pilih_kontrak("KONTRAK-TIDAK-ADA", None)
