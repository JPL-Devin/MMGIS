import os
import unittest
from unittest.mock import patch

from private.api.gdal_dataset_guard import check_dataset_path


def raw_vrt(file):
    return (
        '<VRTDataset rasterXSize="64" rasterYSize="1">'
        '<VRTRasterBand dataType="Byte" band="1" subClass="VRTRawRasterBand">'
        f'<SourceFilename relativeToVRT="0">{file}</SourceFilename>'
        '<ImageOffset>0</ImageOffset><PixelOffset>1</PixelOffset>'
        '<LineOffset>64</LineOffset>'
        "</VRTRasterBand></VRTDataset>"
    )


class GdalDatasetGuardTest(unittest.TestCase):
    def assert_rejected(self, dataset):
        with self.assertRaises(SystemExit) as context:
            check_dataset_path(dataset)
        self.assertEqual(context.exception.code, 1)

    def test_accepts_dataset_under_missions(self):
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        dataset = os.path.join(repo_root, "Missions", "Test", "x.tif")
        self.assertEqual(check_dataset_path(dataset), dataset)

    def test_rejects_inline_vrt(self):
        self.assert_rejected(raw_vrt("/etc/passwd"))

    def test_rejects_local_virtual_file_system_paths(self):
        self.assert_rejected("/vsisubfile/0_64,/etc/passwd")
        self.assert_rejected("/vsizip//etc/passwd")

    def test_rejects_local_paths_outside_missions(self):
        self.assert_rejected("/etc/passwd")
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        self.assert_rejected(os.path.join(repo_root, "Missions", "..", ".env"))

    def test_rejects_remote_dataset_without_allowlist(self):
        with patch.dict(os.environ, {"GDAL_ALLOWED_REMOTE_PREFIXES": ""}):
            self.assert_rejected("/vsicurl/https://x.gov/a.tif")

    def test_accepts_allowlisted_remote_dataset(self):
        dataset = "/vsicurl/https://x.gov/a.tif"
        with patch.dict(
            os.environ,
            {"GDAL_ALLOWED_REMOTE_PREFIXES": "/vsicurl/https://x.gov/"},
        ):
            self.assertEqual(check_dataset_path(dataset), dataset)

    def test_rejects_forbidden_nested_virtual_file_system(self):
        with patch.dict(
            os.environ,
            {"GDAL_ALLOWED_REMOTE_PREFIXES": "/vsicurl/https://x.gov/"},
        ):
            self.assert_rejected("/vsicurl/https://x.gov/vsizip/a.zip")


if __name__ == "__main__":
    unittest.main()
