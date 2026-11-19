"""Run: python bus-pipeline/test_pipeline.py. No network required."""
import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from pipeline import build, merge_stops, query, projection, segment_distance

BASE = json.loads((Path(__file__).parent/'config.json').read_text(encoding='utf-8-sig'))

def node(id_, x, y, name='Test stop', position=False):
    # Coordinates chosen so x/y are approximately metres about Thane.
    return dict(type='node', id=id_, lon=73+x/105000, lat=19.2+y/111195,
                tags={'name':name,'bus':'yes','public_transport':'stop_position' if position else 'platform'})

def road(id_=100, y=0, oneway=None, reverse=False):
    points=[node(1000, -100,y),node(1001,100,y)]
    if reverse:points.reverse()
    tags={'highway':'primary','name':'Test road'}
    if oneway is not None:tags['oneway']=oneway
    return dict(type='way',id=id_,nodes=[p['id'] for p in points],tags=tags,
                geometry=[{'lat':p['lat'],'lon':p['lon']} for p in points])

def relation(ids, ref='12', id_=500):
    return dict(type='relation',id=id_,tags={'route':'bus','ref':ref,'network':'Thane Municipal Transport','operator':'Thane Muncipal Transport'},
                members=[{'type':'node','ref':n,'role':'stop' if n==3 else 'platform'} for n in ids])

def run(nodes, relations=(), roads=None, **settings):
    cfg={**BASE,**settings}
    return build({'elements':[*nodes,*relations]}, {'elements':roads or [road()]}, cfg)

class PipelineTests(unittest.TestCase):
    def test_opposite_sides_and_left_hand_headings(self):
        geo, audit, _=run([node(1,0,4),node(2,0,-4)], [relation([1]),relation([2],'13',501)])
        self.assertEqual(len(geo['features']),2)
        p=[f['properties'] for f in geo['features']]
        self.assertEqual([x['heading'] for x in p],['towards E','towards W'])
        self.assertEqual([x['routes'] for x in p],[['12'],['13']])
        self.assertEqual(len(audit['nearby_kept_separate']),1)
        self.assertFalse(audit['merged'])
    def test_reversing_way_does_not_reverse_travel(self):
        a,_,_=run([node(1,0,4)])
        b,_,_=run([node(1,0,4)],roads=[road(reverse=True)])
        self.assertEqual(a['features'][0]['properties']['heading'],b['features'][0]['properties']['heading'])
    def test_same_physical_stop_merges_without_losing_routes(self):
        geo,audit,summary=run([node(1,0,4),node(2,2,4)], [relation([1]),relation([2],'14',501)])
        self.assertEqual(summary['total_stops'],1)
        self.assertEqual(geo['features'][0]['properties']['routes'],['12','14'])
        self.assertEqual(len(audit['merged']),1)
    def test_different_names_and_unknown_sides_stay_separate(self):
        for nodes in ([node(1,0,4,'A'),node(2,1,4,'B')],[node(1,0,0),node(2,1,0)]):
            self.assertEqual(run(nodes)[2]['total_stops'],2)
    def test_missing_name_does_not_bridge_different_names(self):
        geo,_,_=run([node(1,0,4,''),node(2,1,4,'A'),node(3,2,4,'B')])
        self.assertEqual(len(geo['features']),2)
    def test_stop_position_requires_unique_shared_route(self):
        nodes=[node(1,0,5),node(2,0,-5),node(3,0,0,position=True)]
        geo,_,_=run(nodes,[relation([1,3])])
        self.assertEqual(len(geo['features']),2)
        self.assertEqual(geo['features'][0]['properties']['osm_node_ids'],[1,3])
        self.assertEqual(run(nodes,[relation([1,2,3])])[2]['total_stops'],3)
        self.assertEqual(run(nodes)[2]['total_stops'],3)
    def test_separate_carriageways_and_reverse_oneway(self):
        geo,_,_=run([node(1,0,2),node(2,0,-2)], roads=[road(100,4,'-1'),road(101,-4,'yes')])
        p=[f['properties'] for f in geo['features']]
        self.assertEqual(len(p),2)
        self.assertEqual([x['road_way_id'] for x in p],[100,101])
        self.assertEqual([x['heading'] for x in p],['towards W','towards E'])
    def test_unrelated_platform_is_retained_unknown(self):
        geo,_,summary=run([node(1,0,5,'')])
        p=geo['features'][0]['properties']
        self.assertFalse(p['routes_known']);self.assertEqual(p['routes_message'],'Bus routes not known yet')
        self.assertEqual(summary['stops_without_name'],1)
        self.assertTrue(p['on_highway'])
        self.assertFalse(run([node(1,0,35)])[0]['features'][0]['properties']['on_highway'])
    def test_highway_flag_independent_of_nearest_service_road(self):
        service=road(101,20);service['tags']['highway']='service'
        geo,_,_=run([node(1,0,22)],roads=[road(),service])
        p=geo['features'][0]['properties'];self.assertEqual(p['road_way_id'],101);self.assertTrue(p['on_highway'])
    def test_tmt_tolerant_and_other_operator_toggle(self):
        other=relation([1],'99',501);other['tags']={'route':'bus','network':'BEST','ref':'99'}
        geo,_,_=run([node(1,0,4)],[relation([1]),other],include_other_operators=False)
        self.assertEqual(geo['features'][0]['properties']['routes'],['12'])
    def test_cache_retry_and_partial_response_rejection(self):
        cfg={**BASE,'retries':2}
        with tempfile.TemporaryDirectory() as folder:
            cache=Path(folder)
            with patch('pipeline.urllib.request.urlopen',side_effect=[OSError('timeout'),io.BytesIO(b'{"elements":[]}')]) as request,patch('pipeline.time.sleep'):
                self.assertEqual(query('test','q',cfg,cache),{'elements':[]})
                self.assertEqual(request.call_count,2)
            with patch('pipeline.urllib.request.urlopen',side_effect=AssertionError('Network must not run')):
                self.assertEqual(query('test','q',cfg,cache,offline=True),{'elements':[]})
                with self.assertRaises(RuntimeError):query('test','changed',cfg,cache,offline=True)
            with patch('pipeline.urllib.request.urlopen',side_effect=lambda *a,**k:io.BytesIO(b'{"elements":[],"remark":"timeout"}')),patch('pipeline.time.sleep'):
                with self.assertRaises(RuntimeError):query('bad','bad',cfg,cache)
            self.assertFalse(list(cache.glob('bad-*')))

if __name__=='__main__':unittest.main()
