import java.util.concurrent.locks.ReentrantLock;

final class SafeCounter {
    private final ReentrantLock lock = new ReentrantLock();
    private int value;

    public void increment() {
        lock.lock();
        try {
            int next = value + 1;
            value = next;
        } finally {
            lock.unlock();
        }
    }

    public int value() {
        lock.lock();
        try {
            return value;
        } finally {
            lock.unlock();
        }
    }

    public static void main(String[] args) throws InterruptedException {
        SafeCounter counter = new SafeCounter();
        Runnable incrementOneThousandTimes = () -> {
            for (int index = 0; index < 1_000; index++) {
                counter.increment();
            }
        };

        Thread workerA = new Thread(incrementOneThousandTimes, "worker-a");
        Thread workerB = new Thread(incrementOneThousandTimes, "worker-b");
        workerA.start();
        workerB.start();
        workerA.join();
        workerB.join();

        System.out.printf("expected=2000 actual=%d%n", counter.value());
    }
}
