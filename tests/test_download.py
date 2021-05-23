import requests
from unittest import TestCase
from test_functions import compare_get_request, compare_get_request_download,compare_post_request,compare_get_request_json

class TestDownload(TestCase):

    def test_download(self):
        compare_get_request_download("/public/:collectionId/:displayId/sbol", route_parameters = ["testid1","part_pIKE_Toggle_1"], headers = {"Accept": "text/html"})
        compare_get_request_download("/public/:collectionId/:displayId/:version/sbol", route_parameters = ["testid1","part_pIKE_Toggle_1","1"], headers = {"Accept": "text/html"})
        compare_get_request_download("/public/:collectionId/:displayId/sbolnr", route_parameters = ["testid1","part_pIKE_Toggle_1"], headers = {"Accept": "text/html"})
        compare_get_request_download("/public/:collectionId/:displayId/:version/sbolnr", route_parameters = ["testid1","part_pIKE_Toggle_1","1"], headers = {"Accept": "text/html"})

        # user/testuser/test_attachment/part_pIKE_Toggle_1/1
        compare_get_request_download("/user/:userId/:collectionId/:displayId/sbol", route_parameters = ["testuser","test_attachment","part_pIKE_Toggle_1"], headers = {"Accept": "text/html"})
        compare_get_request_download("/user/:userId/:collectionId/:displayId/sbolnr", route_parameters = ["testuser","test_attachment","part_pIKE_Toggle_1"], headers = {"Accept": "text/html"})
        compare_get_request_download("/user/:userId/:collectionId/:displayId/:version/sbol", route_parameters = ["testuser","test_attachment","part_pIKE_Toggle_1","1"], headers = {"Accept": "text/html"})
        compare_get_request_download("/user/:userId/:collectionId/:displayId/:version/sbolnr", route_parameters = ["testuser","test_attachment","part_pIKE_Toggle_1","1"], headers = {"Accept": "text/html"})

        compare_get_request_download("/public/:collectionId/:displayId/:version/gff", route_parameters = ["testid1","part_pIKE_Toggle_1","1"], headers = {"Accept": "text/html"})
        compare_get_request_download("/public/:collectionId/:displayId/:version/omex", route_parameters = ["testid1","part_pIKE_Toggle_1","1"], headers = {"Accept": "text/html"})
        compare_get_request_download("/public/:collectionId/:displayId/:version/fasta", route_parameters = ["testid1","part_pIKE_Toggle_1","1"], headers = {"Accept": "text/html"})
        compare_get_request_json("/public/:collectionId/:displayId/:version/summary", route_parameters = ["testid1","part_pIKE_Toggle_1","1"], headers = {"Accept": "text/html"})

        compare_get_request_download("/user/:userId/:collectionId/:displayId/:version/gff", route_parameters = ["testuser","test_attachment","part_pIKE_Toggle_1","1"], headers = {"Accept": "text/html"})
        compare_get_request_download("/user/:userId/:collectionId/:displayId/:version/omex", route_parameters = ["testuser","test_attachment","part_pIKE_Toggle_1","1"], headers = {"Accept": "text/html"})
        compare_get_request_download("/user/:userId/:collectionId/:displayId/:version/fasta", route_parameters = ["testuser","test_attachment","part_pIKE_Toggle_1","1"], headers = {"Accept": "text/html"})

        # http://localhost:7777/user/testuser/test_hash/attachment_0ff5d71561d144b7b367765a8c1f2d00/1/download
        # compare_get_request_download("/user/:userId/:collectionId/:displayId/:version/download", route_parameters = ["testuser","test_hash","attachment_0ff5d71561d144b7b367765a8c1f2d00","1"], headers = {"Accept": "text/html"})
