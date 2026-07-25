resource "aws_ecs_service" "orders" {
  name            = "orders-api"
  cluster         = aws_ecs_cluster.production.id
  task_definition = aws_ecs_task_definition.orders.arn
  desired_count   = 6

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    base              = 2
    weight            = 1
  }

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 3
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.orders_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.orders.arn
    container_name   = "api"
    container_port   = 8080
  }

  health_check_grace_period_seconds = 60

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.https]
}
