using UnityEngine;

namespace Aftermath.Player
{
    [RequireComponent(typeof(CharacterController))]
    public class SurvivorController : MonoBehaviour
    {
        [Header("Movement Tuning")]
        public float walkSpeed = 5.4f;
        public float sprintSpeed = 8.4f;
        public float crouchSpeed = 2.8f;
        public float gravity = -19.6f;

        [Header("Stealth & Noise")]
        public bool isCrouching;
        public float currentNoiseRadius;

        private CharacterController _controller;
        private Vector3 _velocity;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
        }

        private void Update()
        {
            float h = Input.GetAxisRaw("Horizontal");
            float v = Input.GetAxisRaw("Vertical");
            if (Input.GetKeyDown(KeyCode.C)) isCrouching = !isCrouching;

            bool sprinting = Input.GetKey(KeyCode.LeftShift) && !isCrouching;
            float targetSpeed = isCrouching ? crouchSpeed : (sprinting ? sprintSpeed : walkSpeed);

            Vector3 move = (transform.right * h + transform.forward * v).normalized;
            _controller.Move(move * (targetSpeed * Time.deltaTime));

            if (_controller.isGrounded && _velocity.y < 0f) _velocity.y = -2f;
            _velocity.y += gravity * Time.deltaTime;
            _controller.Move(_velocity * Time.deltaTime);

            currentNoiseRadius = move.sqrMagnitude < 0.01f ? 1f : (isCrouching ? 4f : (sprinting ? 24f : 11f));
        }
    }
}
