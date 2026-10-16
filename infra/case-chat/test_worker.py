import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('case_chat_worker',Path(__file__).with_name('worker.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class MemoryContractTests(unittest.TestCase):
    def test_recall_includes_source_linked_old_match_and_current_request(self):
        recent=[{'id':'new','role':'user','content':'What was the Amber Cedar codename?','status':'processing'}]
        older=[{'id':'old','role':'user','content':'Codename Amber Cedar 417','status':'completed'},
               {'id':'irrelevant','role':'user','content':'Other unrelated detail','status':'completed'}]
        result=module.recall_history(recent,older,recent[0]['content'])
        self.assertEqual([x['id'] for x in result],['old','new'])

    def test_memory_cannot_invent_provenance(self):
        value={'reply':'A reply','memory':{'summary':'A case-local note','lessons':[{'text':'Use concise replies','source_message_ids':['another-case']}]}}
        with self.assertRaises(ValueError):module.validate_output(value,{'this-case'})

    def test_valid_contextual_lesson_is_preserved(self):
        value={'reply':'A reply','memory':{'summary':'Unverified user goal','lessons':[{'text':'Use concise replies','source_message_ids':['this-case']}]}}
        result=module.validate_output(value,{'this-case'})
        self.assertEqual(result['memory']['lessons'][0]['source_message_ids'],['this-case'])

    def test_only_wholly_empty_array_padding_is_removed(self):
        value={'reply':'A reply','memory':{'summary':'A note','lessons':[{'text':'','source_message_ids':[]}]}}
        self.assertEqual(module.validate_output(value,set())['memory']['lessons'],[])
        value['memory']['lessons']=[{'text':'Some unsupported claim','source_message_ids':[]}]
        with self.assertRaises(ValueError):module.validate_output(value,set())

    def test_invalid_and_oversized_model_outputs_are_rejected(self):
        for value in [None,{'reply':''},{'reply':'x'*12001,'memory':{'summary':'','lessons':[]}},
                      {'reply':'x','memory':{'summary':'x'*6001,'lessons':[]}}]:
            with self.assertRaises(ValueError):module.validate_output(value,set())

if __name__=='__main__':unittest.main()
