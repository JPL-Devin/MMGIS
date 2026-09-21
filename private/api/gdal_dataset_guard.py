import os
import sys


REMOTE_PREFIXES = [
    "/vsicurl/",
    "/vsicurl_streaming/",
    "/vsis3/",
    "/vsis3_streaming/",
    "/vsigs/",
    "/vsigs_streaming/",
    "/vsiaz/",
    "/vsiaz_streaming/",
    "/vsiadls/",
    "/vsioss/",
    "/vsioss_streaming/",
    "/vsiswift/",
    "/vsiswift_streaming/",
    "/vsihdfs/",
    "/vsiwebhdfs/",
    "http://",
    "https://",
    "ftp://",
]

FORBIDDEN_TOKENS = [
    "/vsizip",
    "/vsitar",
    "/vsigzip",
    "/vsi7z",
    "/vsirar",
    "/vsisubfile",
    "/vsimem",
    "/vsistdin",
    "/vsistdout",
    "/vsisparse",
    "/vsicrypt",
]


def _reject():
    print("Invalid dataset path")
    sys.exit(1)


def _remote_prefix_of(dataset):
    return next(
        (prefix for prefix in REMOTE_PREFIXES if dataset.startswith(prefix)), None
    )


def _is_remote(dataset):
    return _remote_prefix_of(dataset) is not None


def _names_a_host(prefix):
    rest = prefix[len(_remote_prefix_of(prefix)) :]
    nested_scheme = next(
        (
            candidate
            for candidate in REMOTE_PREFIXES
            if "://" in candidate and rest.startswith(candidate)
        ),
        None,
    )
    if nested_scheme:
        rest = rest[len(nested_scheme) :]
    return len(rest.split("/")[0]) > 0


def _matches_prefix(dataset, prefix):
    if not dataset.startswith(prefix):
        return False
    rest = dataset[len(prefix) :]
    return prefix.endswith("/") or len(rest) == 0 or rest.startswith("/")


def _allowed_remote_prefixes():
    configured = os.environ.get("GDAL_ALLOWED_REMOTE_PREFIXES", "")
    prefixes = []
    for prefix in configured.split(","):
        prefix = prefix.strip()
        if (
            prefix
            and _is_remote(prefix)
            and _names_a_host(prefix)
        ):
            prefixes.append(prefix)
    return prefixes


def check_dataset_path(dataset: str) -> str:
    dataset = dataset.strip()
    if not dataset or "<" in dataset:
        _reject()

    lowered = dataset.lower()
    if any(token in lowered for token in FORBIDDEN_TOKENS):
        _reject()

    if _is_remote(dataset):
        if ".." in dataset or not any(
            _matches_prefix(dataset, prefix)
            for prefix in _allowed_remote_prefixes()
        ):
            _reject()
        return dataset

    missions_root = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "Missions")
    )
    resolved = os.path.abspath(dataset)
    if resolved != missions_root and not resolved.startswith(missions_root + os.sep):
        _reject()
    return dataset
