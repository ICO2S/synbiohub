import requests
from unittest import TestCase
from test_functions import compare_get_request, compare_post_request


class TestLogout(TestCase):
    def test_logout(self):
        compare_get_request("/logout")

    def test_sparql(self):
        compare_get_request("/sparql")

     def test_advancedSearch(self):
        compare_get_request("/advancedSearch")

