DROP PROCEDURE IF EXISTS sp_user_link_telegram_chat;

CREATE PROCEDURE sp_user_link_telegram_chat(
  IN p_token VARCHAR(64),
  IN p_chat_id BIGINT
)
BEGIN
  DECLARE v_user_id INT UNSIGNED;

  SELECT id INTO v_user_id FROM users WHERE telegram_link_token = p_token;

  -- No SIGNAL here: this is called from a public webhook that receives
  -- whatever arbitrary /start payload a stranger might send. An unmatched
  -- token is a normal, expected outcome, not an error condition.
  IF v_user_id IS NOT NULL THEN
    UPDATE users
    SET telegram_chat_id = p_chat_id, telegram_link_token = NULL
    WHERE id = v_user_id;
  END IF;

  SELECT v_user_id AS user_id;
END;
