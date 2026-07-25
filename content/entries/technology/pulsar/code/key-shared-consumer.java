import java.nio.charset.StandardCharsets;
import org.apache.pulsar.client.api.BatcherBuilder;
import org.apache.pulsar.client.api.Consumer;
import org.apache.pulsar.client.api.Message;
import org.apache.pulsar.client.api.Producer;
import org.apache.pulsar.client.api.PulsarClient;
import org.apache.pulsar.client.api.SubscriptionType;

public final class KeySharedConsumer {
  private static final String TOPIC =
      "persistent://commerce/orders/order-events";

  public static void main(String[] args) throws Exception {
    try (PulsarClient client = PulsarClient.builder()
        .serviceUrl("pulsar://pulsar.example.com:6650")
        .build();
        Producer<byte[]> producer = client.newProducer()
            .topic(TOPIC)
            .batcherBuilder(BatcherBuilder.KEY_BASED)
            .create();
        Consumer<byte[]> consumer = client.newConsumer()
            .topic(TOPIC)
            .subscriptionName("fulfillment")
            .subscriptionType(SubscriptionType.Key_Shared)
            .subscribe()) {

      producer.newMessage()
          .key("customer-42")
          .value("order-created:9817".getBytes(StandardCharsets.UTF_8))
          .send();

      Message<byte[]> message = consumer.receive();
      try {
        processIdempotently(
            message.getKey(),
            new String(message.getData(), StandardCharsets.UTF_8));
        consumer.acknowledge(message);
      } catch (Exception error) {
        consumer.negativeAcknowledge(message);
        throw error;
      }
    }
  }

  private static void processIdempotently(String key, String event) {
    System.out.printf("Process key=%s event=%s%n", key, event);
  }
}
