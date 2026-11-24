using UnityEngine;
using UnityEngine.AI;

namespace Aftermath.Zombies
{
    public enum ZombieArchetype
    {
        Walker,
        Runner,
        Crawler,
        Brute,
        Exploder,
        Spitter,
        Screamer,
        BioArmored,
        BehemothBoss,
        PlagueQueenBoss,
        NecromancerBoss,
        BioTitanBoss
    }

    [RequireComponent(typeof(NavMeshAgent))]
    public class ZombieAI : MonoBehaviour
    {
        public ZombieArchetype archetype = ZombieArchetype.Walker;
        public float maxHp = 80f;
        public float attackDamage = 14f;
        public float attackWindupSeconds = 0.45f;
        public float detectionRange = 22f;

        private float _hp;
        private NavMeshAgent _agent;
        private Transform _player;
        private float _windupTimer;
        private bool _windingUp;

        private void Awake()
        {
            _hp = maxHp;
            _agent = GetComponent<NavMeshAgent>();
            GameObject p = GameObject.FindGameObjectWithTag("Player");
            if (p != null) _player = p.transform;
        }

        private void Update()
        {
            if (_player == null || _hp <= 0f) return;
            float dist = Vector3.Distance(transform.position, _player.position);

            if (dist <= detectionRange)
            {
                _agent.SetDestination(_player.position);
                if (dist <= 2.2f && !_windingUp)
                {
                    _windingUp = true;
                    _windupTimer = attackWindupSeconds;
                }
            }

            if (_windingUp)
            {
                _windupTimer -= Time.deltaTime;
                if (_windupTimer <= 0f)
                {
                    _windingUp = false;
                    if (Vector3.Distance(transform.position, _player.position) <= 2.5f)
                    {
                        _player.SendMessage("ApplyDamage", attackDamage, SendMessageOptions.DontRequireReceiver);
                    }
                }
            }
        }

        public void TakeDamage(float dmg)
        {
            _hp -= dmg;
            if (_hp <= 0f) Destroy(gameObject, 0.35f);
        }
    }
}
